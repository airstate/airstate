import React, { useState } from 'react';
import { useSharedState, configure } from '@airstate/react';

type Todo = {
    text: string;
    done: boolean;
};

type Todos = {
    [id: number]: Todo;
};

configure({
    appKey: 'shared-to-do',
    server: `ws://${window.location.hostname}:11001/ws`,
});

// Component for a single instance of the shared todo app
function SharedTodoInstance({ roomKey }: { roomKey: string }) {
    const [todos, setTodos, isReady] = useSharedState<Todos>(
        {},
        {
            key: roomKey,
        },
    );
    const [input, setInput] = React.useState('');

    const addTodo = () => {
        if (input.trim() === '') return;
        const id = Date.now();
        setTodos({ ...todos, [id]: { text: input, done: false } });
        setInput('');
    };

    const toggleTodo = (id: number) => {
        setTodos({
            ...todos,
            [id]: { ...todos[id], done: !todos[id].done },
        });
    };

    const removeTodo = (id: number) => {
        const newTodos = { ...todos };
        delete newTodos[id];
        setTodos(newTodos);
    };

    return (
        <div className="max-w-md mx-auto p-4 border rounded mb-8">
            <h2 className="text-xl font-bold mb-2">Room: {roomKey}</h2>
            <div className="flex mb-4">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="border rounded px-2 py-1 flex-1"
                    placeholder="Add a task..."
                />
                <button onClick={addTodo} className="ml-2 px-4 py-1 bg-blue-500 text-white rounded">
                    Add
                </button>
            </div>
            <ul>
                {Object.entries(todos)
                    .sort(([idA], [idB]) => Number(idB) - Number(idA))
                    .map(([id, todo]) => (
                        <li key={id} className="flex justify-between items-center mb-2">
                            <span
                                className={`flex-1 cursor-pointer ${todo.done ? 'line-through text-gray-500' : ''}`}
                                onClick={() => toggleTodo(Number(id))}>
                                {todo.text}
                            </span>
                            <button onClick={() => removeTodo(Number(id))} className="ml-2 text-red-500">
                                ✕
                            </button>
                        </li>
                    ))}
            </ul>
        </div>
    );
}

// Main application that can show multiple instances
export default function Copy() {
    // Define your different tokens
    const instances = [
        {
            roomKey: 'tomato-room',
        },
        {
            roomKey: 'tomato-room',
        },
    ];

    const [showBoth, setShowBoth] = useState(false);

    return (
        <div className="max-w-2xl mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Shared TODO App</h1>

            <div className="mb-4">
                <label>
                    <input
                        type="checkbox"
                        checked={showBoth}
                        onChange={() => setShowBoth(!showBoth)}
                        className="mr-2"
                    />
                    Show both instances
                </label>
            </div>

            {showBoth ? (
                // Show all instances
                instances.map((instance, index) => <SharedTodoInstance key={index} roomKey={instance.roomKey} />)
            ) : (
                // Show only first instance
                <SharedTodoInstance roomKey={instances[0].roomKey} />
            )}
        </div>
    );
}
