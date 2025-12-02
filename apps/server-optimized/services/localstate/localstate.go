package localstate

import (
	"sync"

	"github.com/nats-io/nats.go"
)

type Service interface {
	GetLocalState() *LocalState
}

type LocalState struct {
	mu          sync.RWMutex
	sessionMeta map[string]*ServerStateSession
}

type ServerStateSession struct {
	Keys          map[string]struct{}
	Handler       func(stateKey string, data any)
	Meta          map[string]any
	Subscriptions map[string]*nats.Subscription
}

func CreateLocalStateService() *LocalState {
	return &LocalState{
		sessionMeta: make(map[string]*ServerStateSession),
	}
}

func (l *LocalState) GetLocalState() *LocalState {
	return l
}

func (l *LocalState) GetSession(sessionID string) (*ServerStateSession, bool) {
	l.mu.RLock()
	defer l.mu.RUnlock()

	session, ok := l.sessionMeta[sessionID]
	return session, ok
}

func (l *LocalState) UpsertServerStateSession(sessionID string) *ServerStateSession {
	l.mu.Lock()
	defer l.mu.Unlock()

	session, ok := l.sessionMeta[sessionID]
	if !ok {
		session = &ServerStateSession{
			Keys:          make(map[string]struct{}),
			Meta:          make(map[string]any),
			Subscriptions: make(map[string]*nats.Subscription),
		}

		l.sessionMeta[sessionID] = session
	}

	return session
}

func (l *LocalState) SetSession(sessionID string, session *ServerStateSession) {
	l.mu.Lock()
	defer l.mu.Unlock()

	l.sessionMeta[sessionID] = session
}

func (l *LocalState) DeleteSession(sessionID string) {
	l.mu.Lock()
	defer l.mu.Unlock()

	delete(l.sessionMeta, sessionID)
}

