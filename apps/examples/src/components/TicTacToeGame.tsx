import React, { useEffect, useReducer, useRef, useState } from 'react';
import { Copy, Users, RotateCcw, Trophy, Circle, X } from 'lucide-react';
import { useSharedState, configure } from '@airstate/react';
import { nanoid } from 'nanoid';

configure({
    appKey: 'pk_airstate_LXFRiGpgf9OXYJYGK_kuU',
    server: `wss://server.airstate.dev/ws`,
});

type Player = {
    symbol: 'X' | 'O';
    joinedAt: number;
    isHost: boolean;
};

type GameState = {
    board: (null | 'X' | 'O')[];
    currentPlayer: string;
    winner: null | 'X' | 'O' | 'tie';
    gameStarted: boolean;
    players: Record<string, Player>;
    gameId: string;
};

const DEFAULT_GAME: GameState = {
    board: Array(9).fill(null),
    currentPlayer: '',
    winner: null,
    gameStarted: false,
    players: {},
    gameId: nanoid(),
};

const TicTacToeGame = () => {
    const [playerId] = useState(() => `player_${nanoid()}`);
    const [linkCopied, setLinkCopied] = useState(false);

    const [myset] = useState(new Set<any>());

    const params = new URLSearchParams(window.location.search);
    const joiningKey = params.get('joiningKey');
    const [roomKey] = useState(() => joiningKey || nanoid());

    const joinLink = `${window.location.origin}${window.location.pathname}?joiningKey=${roomKey}`;

    const [gameState, setGameState, isSynced] = useSharedState<GameState>(DEFAULT_GAME, {
        key: roomKey,
    });

    console.log('gamestate', JSON.stringify(gameState, null, 2), myset.has(gameState), myset.size, isSynced, roomKey);

    myset.add(gameState);

    useEffect(() => {
        console.log('useEffectGamestate');
    }, [gameState]);

    // useEffect(() => {
    //     setTimeout(() => {
    //         setGameState((prev) => {
    //             return {
    //                 ...prev,
    //             };
    //         });
    //     }, 2000);
    // }, []);

    const playerCount = Object.keys(gameState.players).length;

    useEffect(() => {
        if (!isSynced || gameState.players[playerId]) return;
        const playerCount = Object.keys(gameState.players).length;
        if (playerCount >= 2) return;
        const symbol: 'X' | 'O' = playerCount === 0 ? 'X' : 'O';
        const isFirstPlayer = playerCount === 0;
        setTimeout(() => {
            setGameState((prev) => ({
                ...prev,
                players: {
                    ...prev.players,
                    [playerId]: {
                        symbol,
                        joinedAt: Date.now(),
                        isHost: isFirstPlayer,
                    },
                },
                currentPlayer: isFirstPlayer ? playerId : prev.currentPlayer,
                // Do NOT start the game yet, wait for 2 players
            }));
        }, 2000);
    }, [isSynced, playerId, gameState.players, roomKey]);

    // Start the game when there are exactly 2 players and not already started
    useEffect(() => {
        if (!isSynced) return;
        const playerIds = Object.keys(gameState.players);
        if (playerIds.length === 2 && !gameState.gameStarted) {
            // The first player to join is the currentPlayer
            setGameState((prev) => ({
                ...prev,
                gameStarted: true,
                currentPlayer: playerIds[0],
            }));
        }
    }, [isSynced, gameState.players, gameState.gameStarted, setGameState]);

    const isMyTurn = gameState.currentPlayer === playerId;
    const myInfo = gameState.players[playerId];
    const currentPlayerInfo = gameState.players[gameState.currentPlayer];

    const checkWinner = (board: (null | 'X' | 'O')[]): 'X' | 'O' | 'tie' | null => {
        const wins = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6],
        ];
        for (const [a, b, c] of wins) {
            if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
        }
        return board.every((cell) => cell !== null) ? 'tie' : null;
    };

    const getNextPlayer = (): string => {
        const ids = Object.keys(gameState.players);
        const idx = ids.indexOf(gameState.currentPlayer);
        return ids[(idx + 1) % ids.length];
    };

    const makeMove = (index: number) => {
        if (!gameState.gameStarted || gameState.winner || gameState.board[index] || !isMyTurn) return;
        const board = [...gameState.board];
        board[index] = myInfo.symbol;
        const winner = checkWinner(board);
        setGameState((prev) => ({
            ...prev,
            board,
            currentPlayer: winner ? prev.currentPlayer : getNextPlayer(),
            winner,
        }));
    };

    const resetGame = () => {
        setGameState((prev) => ({
            ...prev,
            board: Array(9).fill(null),
            winner: null,
            currentPlayer: Object.keys(prev.players)[0] || '',
            gameId: nanoid(),
        }));
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(joinLink);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        } catch (e) {
            console.error(e);
        }
    };
    useEffect(() => {
        //console.log('player_count ', playerCount);
    }, [playerCount]);

    console.log('player_count ', playerCount.toString());

    if (!isSynced) {
        return (
            <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
                    <p className="text-gray-600">Connecting to game...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Header */}
                <div className="text-center">
                    <h1 className="text-4xl font-bold flex items-center justify-center gap-2">
                        <Trophy className="text-yellow-500" />
                        Tic-Tac-Toe
                    </h1>
                    <p className="text-gray-600">Multiplayer Game</p>
                </div>

                {/* Game Info */}
                <div className="bg-white p-6 rounded-xl shadow">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                            <Users className="text-blue-500" />
                            Players: {playerCount}/2 tomato
                        </div>
                        {gameState.gameStarted && (
                            <button
                                onClick={resetGame}
                                className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">
                                <RotateCcw size={16} /> Reset
                            </button>
                        )}
                    </div>

                    {/* Waiting State */}
                    {!gameState.gameStarted && playerCount === 1 && (
                        <div className="text-center">
                            <p className="mb-4 text-gray-500">Waiting for second player...</p>
                            <div className="bg-gray-100 p-4 rounded">
                                <p className="text-sm mb-2">Share this link:</p>
                                <div className="flex gap-2">
                                    <input
                                        readOnly
                                        value={joinLink}
                                        className="flex-1 px-2 py-1 border rounded text-sm"
                                    />
                                    <button
                                        onClick={copyLink}
                                        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">
                                        {linkCopied ? 'Copied!' : <Copy size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Game Turn */}
                    {gameState.gameStarted && (
                        <div className="text-center text-lg font-medium">
                            {gameState.winner
                                ? gameState.winner === 'tie'
                                    ? "It's a tie!"
                                    : `Player ${gameState.winner} wins!`
                                : isMyTurn
                                  ? `Your turn (${myInfo?.symbol})`
                                  : `Opponent's turn (${currentPlayerInfo?.symbol})`}
                        </div>
                    )}
                </div>

                {/* Board */}
                <div className="bg-white p-6 rounded-xl shadow grid grid-cols-3 gap-2 max-w-xs mx-auto">
                    {gameState.board.map((cell, i) => (
                        <button
                            key={i}
                            onClick={() => makeMove(i)}
                            disabled={!gameState.gameStarted || !!cell || !!gameState.winner || !isMyTurn}
                            className="aspect-square text-4xl font-bold flex items-center justify-center rounded border border-gray-200 bg-gray-50 hover:bg-blue-100 disabled:cursor-not-allowed">
                            {cell === 'X' && <X className="text-blue-500" size={32} />}
                            {cell === 'O' && <Circle className="text-red-500" size={32} />}
                        </button>
                    ))}
                </div>

                {/* Player List */}
                {gameState.gameStarted && (
                    <div className="bg-white p-4 rounded-xl shadow">
                        <h3 className="font-semibold mb-2">Players</h3>
                        {Object.entries(gameState.players).map(([id, p]) => (
                            <div key={id} className={`p-2 rounded ${id === playerId ? 'bg-blue-50' : 'bg-gray-50'}`}>
                                <div className="flex justify-between">
                                    <span>
                                        {p.symbol} {id === playerId ? '(You)' : ''}
                                    </span>
                                    {p.isHost && <span className="text-xs text-yellow-600">Host</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TicTacToeGame;
