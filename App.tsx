import React, { useState, useEffect, createContext, useContext, useMemo, useCallback, ReactNode } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import { Page, Team, Task, AppState, StockItem, StockHistory, Flock, DailyLog } from './types';
import { HomeIcon, ButcheryIcon, MaintenanceIcon, BroilerIcon, MoreIcon, AdminIcon, ExportIcon, PlusCircleIcon, CheckCircleIcon, CircleIcon, CalendarIcon, ClockIcon, TrashIcon, XIcon } from './components/Icons';

// FIX: Declare global properties on window to resolve TypeScript errors for external libraries.
declare global {
    interface Window {
        Recharts: any;
        jspdf: any;
        html2canvas: any;
    }
}

// Helper Functions
const getTodayDateString = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString().split('T')[0];
};

const getDayOfWeek = (date: Date) => {
    return date.getDay() === 0 ? 7 : date.getDay(); // Sunday as 7, Monday as 1
};

// --- Initial Demo Data ---
const getInitialData = (): AppState => {
    const today = new Date();
    const getNextDate = (daysToAdd: number) => {
        const date = new Date(today);
        date.setDate(today.getDate() + daysToAdd);
        return date.toISOString().split('T')[0];
    };
    
    const getEndOfWeek = () => {
        const date = new Date(today);
        date.setDate(date.getDate() + (5 - getDayOfWeek(today) + 7) % 7);
        return date.toISOString().split('T')[0];
    }

    const recurringEndDate = getEndOfWeek();

    return {
        tasks: [
            { id: 'm1', title: 'Water the front yard', team: Team.Maintenance, dueDate: getNextDate(0), isCompleted: false, isRecurring: true, recurringDays: [1, 2, 3, 4, 5], recurringEndDate, addedBy: 'admin', notes: 'Use the new sprinkler heads near the gate.' },
            { id: 'm2', title: 'Security checks', team: Team.Maintenance, dueDate: getNextDate(0), time: '08:00', isCompleted: false, isRecurring: true, recurringDays: [1, 2, 3, 4, 5], recurringEndDate, addedBy: 'admin' },
            { id: 'b1', title: 'Clean Butchery', team: Team.Butchery, dueDate: getNextDate(0), isCompleted: true, isRecurring: true, recurringDays: [1, 2, 3, 4, 5], recurringEndDate, addedBy: 'admin' },
            { id: 'b2', title: 'Cut Meats', team: Team.Butchery, dueDate: getNextDate(0), time: '10:00', isCompleted: false, isRecurring: true, recurringDays: [1, 2, 3, 4, 5], recurringEndDate, addedBy: 'admin' },
            { id: 'b3', title: 'Update Stock', team: Team.Butchery, dueDate: getNextDate(0), time: '16:00', isCompleted: false, isRecurring: true, recurringDays: [1, 2, 3, 4, 5], recurringEndDate, addedBy: 'admin', notes: 'Cross-reference with the delivery invoice from yesterday.' },
        ],
        stockItems: [
            { id: 's1', name: 'Chicken', currentStockKg: 10, pricePerKgUSD: 4.50 },
            { id: 's2', name: 'Beef', currentStockKg: 5, pricePerKgUSD: 5.50 },
            { id: 's3', name: 'Fish', currentStockKg: 5, pricePerKgUSD: 5.50 },
        ],
        stockHistory: [
            { id: 'h1', stockItemId: 's1', stockItemName: 'Chicken', date: new Date().toISOString(), type: 'initial', amountKg: 10 },
            { id: 'h2', stockItemId: 's2', stockItemName: 'Beef', date: new Date().toISOString(), type: 'initial', amountKg: 5 },
            { id: 'h3', stockItemId: 's3', stockItemName: 'Fish', date: new Date().toISOString(), type: 'initial', amountKg: 5 },
        ],
        flocks: [],
    };
};

// --- App Context ---
const AppContext = createContext<{
    appState: AppState;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
    addTask: (task: Omit<Task, 'id' | 'isCompleted'>) => void;
    toggleTask: (taskId: string, date: string) => void;
    updateTaskNotes: (taskId: string, notes: string) => void;
    addStockItem: (item: Omit<StockItem, 'id'>) => void;
    updateStock: (stockItemId: string, amountKg: number, type: 'add' | 'sale') => void;
    addFlock: (flock: Omit<Flock, 'id' | 'dailyLogs'>) => void;
    addDailyLog: (flockId: string, log: Omit<DailyLog, 'id'>) => void;
} | null>(null);

const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error("useAppContext must be used within an AppProvider");
    return context;
};

const AppProvider = ({ children }: { children: ReactNode }) => {
    const [appState, setAppState] = useLocalStorage<AppState>('royalPalmsTodoApp_v0.2_data', getInitialData());
    
    const addTask = useCallback((task: Omit<Task, 'id' | 'isCompleted'>) => {
        const newTask: Task = {
            ...task,
            id: `task-${Date.now()}`,
            isCompleted: false,
        };
        setAppState(prev => ({ ...prev, tasks: [...prev.tasks, newTask] }));
    }, [setAppState]);

    const toggleTask = useCallback((taskId: string, date: string) => {
        setAppState(prev => ({
            ...prev,
            tasks: prev.tasks.map(t => t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t)
        }));
    }, [setAppState]);
    
    const updateTaskNotes = useCallback((taskId: string, notes: string) => {
        setAppState(prev => ({
            ...prev,
            tasks: prev.tasks.map(t => t.id === taskId ? { ...t, notes } : t)
        }));
    }, [setAppState]);

    const addStockItem = useCallback((item: Omit<StockItem, 'id'>) => {
        const newItem: StockItem = { ...item, id: `stock-${Date.now()}` };
        const newHistory: StockHistory = {
            id: `hist-${Date.now()}`,
            stockItemId: newItem.id,
            stockItemName: newItem.name,
            date: new Date().toISOString(),
            type: 'initial',
            amountKg: item.currentStockKg,
        }
        setAppState(prev => ({
            ...prev,
            stockItems: [...prev.stockItems, newItem],
            stockHistory: [newHistory, ...prev.stockHistory]
        }));
    }, [setAppState]);

    const updateStock = useCallback((stockItemId: string, amountKg: number, type: 'add' | 'sale') => {
        let amountUSD: number | undefined;
        let stockItemName = '';
        const updatedStockItems = appState.stockItems.map(item => {
            if (item.id === stockItemId) {
                stockItemName = item.name;
                const newStock = type === 'add' ? item.currentStockKg + amountKg : item.currentStockKg - amountKg;
                if (type === 'sale') {
                    amountUSD = amountKg * item.pricePerKgUSD;
                }
                return { ...item, currentStockKg: parseFloat(newStock.toFixed(3)) };
            }
            return item;
        });

        const newHistory: StockHistory = {
            id: `hist-${Date.now()}`,
            stockItemId,
            stockItemName,
            date: new Date().toISOString(),
            type,
            amountKg,
            amountUSD
        };
        setAppState(prev => ({ ...prev, stockItems: updatedStockItems, stockHistory: [newHistory, ...prev.stockHistory] }));
    }, [appState.stockItems, setAppState]);

    const addFlock = useCallback((flock: Omit<Flock, 'id' | 'dailyLogs'>) => {
        const newFlock: Flock = { ...flock, id: `flock-${Date.now()}`, dailyLogs: [] };
        setAppState(prev => ({ ...prev, flocks: [...prev.flocks, newFlock] }));
    }, [setAppState]);

    const addDailyLog = useCallback((flockId: string, log: Omit<DailyLog, 'id'>) => {
        const newLog: DailyLog = { ...log, id: `log-${Date.now()}` };
        const updatedFlocks = appState.flocks.map(f => {
            if (f.id === flockId) {
                return { ...f, dailyLogs: [newLog, ...f.dailyLogs] };
            }
            return f;
        });
        setAppState(prev => ({ ...prev, flocks: updatedFlocks }));
    }, [appState.flocks, setAppState]);

    const value = useMemo(() => ({ appState, setAppState, addTask, toggleTask, updateTaskNotes, addStockItem, updateStock, addFlock, addDailyLog }), [appState, setAppState, addTask, toggleTask, updateTaskNotes, addStockItem, updateStock, addFlock, addDailyLog]);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};


// --- UI Components ---
const DateSelector = ({ selectedDate, setSelectedDate }: { selectedDate: Date, setSelectedDate: (date: Date) => void }) => {
    const dates = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Array.from({ length: 7 }, (_, i) => {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            return date;
        });
    }, []);

    return (
        <div className="flex p-1 space-x-1 bg-slate-200/50 rounded-lg">
            {dates.map(date => {
                const isSelected = date.toDateString() === selectedDate.toDateString();
                return (
                    <button
                        key={date.toISOString()}
                        onClick={() => setSelectedDate(date)}
                        className={`flex flex-col items-center justify-center grow py-2 rounded-md transition-all duration-200 ease-in-out ${isSelected ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                    >
                        <span className="text-sm font-semibold">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                        <span className="text-lg font-bold">{date.getDate()}</span>
                    </button>
                );
            })}
        </div>
    );
};

const TaskItem = ({ task, onToggle, isOverdue, canComplete, onImageClick, onViewDetails }: { task: Task, onToggle: (task: Task) => void, isOverdue: boolean, canComplete: boolean, onImageClick: (imageUrl: string) => void, onViewDetails: (task: Task) => void }) => {
    return (
        <div className={`p-4 rounded-lg flex items-start space-x-4 border transition-all duration-200 ${task.isCompleted ? 'bg-slate-50' : 'bg-white'} ${isOverdue && !task.isCompleted ? 'border-red-300' : 'border-slate-200'}`}>
            <button onClick={canComplete ? () => onToggle(task) : undefined} disabled={!canComplete} className={`mt-1 flex-shrink-0 ${!canComplete ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                {task.isCompleted ? <CheckCircleIcon className="w-6 h-6 text-green-500" /> : <CircleIcon className="w-6 h-6 text-slate-300" />}
            </button>
            <div className="flex-grow cursor-pointer" onClick={() => onViewDetails(task)}>
                <p className={`font-semibold ${task.isCompleted ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</p>
                {task.description && <p className="text-sm text-slate-500 mt-1">{task.description}</p>}
                {task.imageUrl && (
                    <div className="mt-2">
                        <button onClick={(e) => { e.stopPropagation(); onImageClick(task.imageUrl!); }}>
                            <img src={task.imageUrl} alt="Task attachment" className="h-20 w-20 rounded-md object-cover cursor-pointer hover:opacity-80 transition-opacity" />
                        </button>
                    </div>
                )}
            </div>
             <div className="text-right text-sm text-slate-500 flex-shrink-0">
                {task.time && <span>{task.time}</span>}
                {isOverdue && !task.isCompleted && <div className="text-red-500 font-bold text-xs mt-1">OVERDUE</div>}
            </div>
        </div>
    );
};

// Fix: Make selectedDate optional and add guards to handle cases where it's not provided.
const TaskList = ({ team, selectedDate }: { team?: Team, selectedDate?: Date }) => {
    const { appState, toggleTask, addTask } = useAppContext();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [taskToConfirm, setTaskToConfirm] = useState<Task | null>(null);
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const [isUserAddTaskModalOpen, setIsUserAddTaskModalOpen] = useState(false);
    const [detailedTask, setDetailedTask] = useState<Task | null>(null);

    const filteredTasks = useMemo(() => {
        // Fix: Add guard for optional selectedDate
        if (!selectedDate) return [];
        return appState.tasks
            .filter(task => {
                if(team && task.team !== team) return false;

                const taskDueDate = new Date(task.dueDate);
                taskDueDate.setHours(0, 0, 0, 0);

                if (task.isRecurring && task.recurringDays) {
                    const selectedDayOfWeek = getDayOfWeek(selectedDate);
                    const recurringEndDate = task.recurringEndDate ? new Date(task.recurringEndDate) : null;
                    if (recurringEndDate) recurringEndDate.setHours(23, 59, 59, 999);

                    const isAfterStartDate = selectedDate >= taskDueDate;
                    const isBeforeEndDate = !recurringEndDate || selectedDate <= recurringEndDate;
                    const isOnRecurringDay = task.recurringDays.includes(selectedDayOfWeek);
                    
                    return isAfterStartDate && isBeforeEndDate && isOnRecurringDay;
                }
                return taskDueDate.toDateString() === selectedDate.toDateString();
            })
            .sort((a, b) => {
                if (a.isCompleted && !b.isCompleted) return 1;
                if (!a.isCompleted && b.isCompleted) return -1;
                if (a.time && b.time) return a.time.localeCompare(b.time);
                if (a.time) return -1;
                if (b.time) return 1;
                return 0;
            });
    }, [appState.tasks, team, selectedDate]);
    
    // Fix: Add guard for optional selectedDate before rendering
    if (!selectedDate) return null;

    const handleRequestToggle = (task: Task) => {
        if (!task.isCompleted) {
            setTaskToConfirm(task);
        } else {
            toggleTask(task.id, selectedDate.toISOString());
        }
    };

    const handleConfirmToggle = () => {
        if (taskToConfirm && selectedDate) {
            toggleTask(taskToConfirm.id, selectedDate.toISOString());
            setTaskToConfirm(null);
        }
    };
    
    const handleCancelToggle = () => {
        setTaskToConfirm(null);
    };

    const handleImageClick = (imageUrl: string) => {
        setViewingImage(imageUrl);
    };

    const handleUserAddTask = (taskData: { title: string, description: string }) => {
        if (!team || !selectedDate) return;
        addTask({
            ...taskData,
            title: taskData.title,
            description: taskData.description || undefined,
            team: team,
            dueDate: selectedDate.toISOString().split('T')[0],
            isRecurring: false,
            addedBy: 'user',
        });
        setIsUserAddTaskModalOpen(false);
    };

    const getConfirmationMessage = () => {
        if (!taskToConfirm) return "";
        const taskDueDate = new Date(taskToConfirm.dueDate);
        taskDueDate.setHours(0, 0, 0, 0);
        const isOverdue = taskDueDate < today && !taskToConfirm.isCompleted;
        return isOverdue
            ? "This task is overdue. Are you sure you want to mark it as complete?"
            : "Are you sure you want to mark this task as complete?";
    };

    return (
        <>
            {team && (
                <div className="flex justify-end mb-4">
                    <button 
                        onClick={() => setIsUserAddTaskModalOpen(true)} 
                        className="flex items-center gap-2 bg-slate-800 text-white font-semibold py-2 px-4 rounded-lg hover:bg-slate-900 transition-colors shadow-sm"
                    >
                        <PlusCircleIcon className="w-5 h-5"/>
                        <span>Add My Task</span>
                    </button>
                </div>
            )}
            <div className="space-y-3">
                {filteredTasks.length > 0 ? filteredTasks.map(task => {
                    const taskDueDate = new Date(task.dueDate);
                    taskDueDate.setHours(0, 0, 0, 0);
                    const isOverdue = taskDueDate < today && !task.isCompleted;
                    const canComplete = selectedDate >= taskDueDate;
                    return (
                        <TaskItem 
                            key={task.id} 
                            task={task} 
                            onToggle={handleRequestToggle} 
                            isOverdue={isOverdue} 
                            canComplete={canComplete}
                            onImageClick={handleImageClick}
                            onViewDetails={setDetailedTask}
                        />
                    );
                }) : (
                    <div className="text-center py-16 px-4 bg-white rounded-lg border border-slate-200">
                        <CalendarIcon className="w-12 h-12 mx-auto text-slate-400"/>
                        <p className="mt-4 text-lg font-semibold text-slate-700">No tasks for this day.</p>
                        <p className="text-slate-500">Enjoy your day or select another date!</p>
                    </div>
                )}
            </div>

            {taskToConfirm && (
                <ConfirmationModal
                    isOpen={!!taskToConfirm}
                    onClose={handleCancelToggle}
                    onConfirm={handleConfirmToggle}
                    title="Confirm Completion"
                >
                    <p className="text-slate-600">{getConfirmationMessage()}</p>
                </ConfirmationModal>
            )}

            {viewingImage && (
                <ImageModal imageUrl={viewingImage} onClose={() => setViewingImage(null)} />
            )}
            
            {detailedTask && (
                <TaskDetailModal task={detailedTask} onClose={() => setDetailedTask(null)} />
            )}

            {isUserAddTaskModalOpen && (
                <UserAddTaskModal
                    onClose={() => setIsUserAddTaskModalOpen(false)}
                    onAddTask={handleUserAddTask}
                />
            )}
        </>
    );
};

// --- Pages ---

const HomePage = () => {
    const { appState } = useAppContext();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueTodayTasks = useMemo(() => {
        return appState.tasks.filter(task => {
            const taskDueDate = new Date(task.dueDate);
            taskDueDate.setHours(0, 0, 0, 0);
            
            if (task.isRecurring && task.recurringDays) {
                const todayDayOfWeek = getDayOfWeek(today);
                 const recurringEndDate = task.recurringEndDate ? new Date(task.recurringEndDate) : null;
                 if (recurringEndDate) recurringEndDate.setHours(23, 59, 59, 999);
                 
                const isAfterStartDate = today >= taskDueDate;
                const isBeforeEndDate = !recurringEndDate || today <= recurringEndDate;
                const isOnRecurringDay = task.recurringDays.includes(todayDayOfWeek);

                return !task.isCompleted && isAfterStartDate && isBeforeEndDate && isOnRecurringDay;
            }
            return !task.isCompleted && taskDueDate.toDateString() === today.toDateString();
        });
    }, [appState.tasks, today]);

    const butcheryTasks = dueTodayTasks.filter(t => t.team === Team.Butchery);
    const maintenanceTasks = dueTodayTasks.filter(t => t.team === Team.Maintenance);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-500">Overview of tasks due today, {today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.</p>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800"><ButcheryIcon/> Butchery Tasks</h2>
                    <ul className="mt-4 space-y-2 list-disc list-inside text-slate-700">
                        {butcheryTasks.length > 0 ? butcheryTasks.map(t => <li key={t.id}>{t.title}</li>) : <li className="list-none text-slate-500">No tasks due today.</li>}
                    </ul>
                </div>
                <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800"><MaintenanceIcon/> Maintenance Tasks</h2>
                    <ul className="mt-4 space-y-2 list-disc list-inside text-slate-700">
                        {maintenanceTasks.length > 0 ? maintenanceTasks.map(t => <li key={t.id}>{t.title}</li>) : <li className="list-none text-slate-500">No tasks due today.</li>}
                    </ul>
                </div>
            </div>
        </div>
    );
};

// Fix: Change children prop to be a React.ReactElement for better type safety with React.cloneElement
// FIX: The `children` prop is typed as `React.ReactElement<any>` to resolve a TypeScript error with `React.cloneElement`. This allows new props to be added to the child element without causing a type mismatch, as TypeScript's strict type checking would otherwise prevent adding unknown properties.
const PageWithDateSelector = ({ children, title }: { children: React.ReactElement<any>, title: string }) => {
    const [selectedDate, setSelectedDate] = useState(() => {
        const d = new Date();
        d.setHours(0,0,0,0);
        return d;
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
                </div>
                {/* Fix: Pass selectedDate to the child component. The cast is no longer needed with the updated prop type. */}
                {React.cloneElement(children, { selectedDate })}
            </div>
            <div className="lg:col-span-1">
                <div className="p-4 bg-white rounded-lg border border-slate-200 lg:sticky top-6">
                     <h2 className="text-lg font-semibold mb-4 text-center">Select a Day</h2>
                     <DateSelector selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
                </div>
            </div>
        </div>
    );
}

const MaintenancePage = () => (
    <PageWithDateSelector title="Maintenance To-Do">
        {/* Fix: Remove the selectedDate prop as it's now injected by PageWithDateSelector */}
        <TaskList team={Team.Maintenance} />
    </PageWithDateSelector>
);

const ButcheryPage = () => {
    const [view, setView] = useState<'ToDo' | 'Stock'>('ToDo');
    const { appState, addStockItem, updateStock } = useAppContext();
    
    // Defer loading of Recharts components until they are available on the window object
    const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } = window.Recharts || {};

    const [isSaleModalOpen, setSaleModalOpen] = useState(false);
    const [isAddStockModalOpen, setAddStockModalOpen] = useState(false);
    const [isNewItemModalOpen, setNewItemModalOpen] = useState(false);
    const [selectedStockItem, setSelectedStockItem] = useState<StockItem | null>(null);

    const handleSale = (itemId: string, saleUSD: number) => {
        const item = appState.stockItems.find(i => i.id === itemId);
        if (item) {
            const kgSold = saleUSD / item.pricePerKgUSD;
            updateStock(itemId, kgSold, 'sale');
        }
    };
    
    const handleAddStock = (itemId: string, amountKg: number) => {
        updateStock(itemId, amountKg, 'add');
    };

    return (
        <div className="space-y-4">
             <div className="border-b border-slate-200">
                 <div className="flex space-x-4">
                    <button onClick={() => setView('ToDo')} className={`px-3 py-2 font-semibold transition-colors ${view === 'ToDo' ? 'border-b-2 border-slate-800 text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>ToDo</button>
                    <button onClick={() => setView('Stock')} className={`px-3 py-2 font-semibold transition-colors ${view === 'Stock' ? 'border-b-2 border-slate-800 text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Stock Update</button>
                </div>
             </div>
            {view === 'ToDo' && (
                <PageWithDateSelector title="Butchery To-Do">
                    {/* Fix: Remove the selectedDate prop as it's now injected by PageWithDateSelector */}
                    <TaskList team={Team.Butchery} />
                </PageWithDateSelector>
            )}
            
            {view === 'Stock' && (
                <div className="space-y-6">
                    <div className="bg-white p-4 rounded-lg border border-slate-200">
                        <h2 className="text-xl font-bold mb-4">Stock Overview</h2>
                         <div style={{ width: '100%', height: 300 }}>
                           {ResponsiveContainer && BarChart ? (
                               <ResponsiveContainer>
                                   <BarChart data={appState.stockItems} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                       <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                       <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                       <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}kg`}/>
                                       <Tooltip wrapperClassName="!bg-white !border-slate-200 !rounded-md !shadow-lg" cursor={{fill: 'rgba(241, 245, 249, 0.5)'}} />
                                       <Legend iconSize={10} />
                                       <Bar dataKey="currentStockKg" fill="#14b8a6" name="Stock (kg)" radius={[4, 4, 0, 0]} />
                                   </BarChart>
                               </ResponsiveContainer>
                           ) : (
                               <div className="flex items-center justify-center h-full text-slate-500">Loading Chart...</div>
                           )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {appState.stockItems.map(item => (
                            <div key={item.id} className="bg-white p-4 rounded-lg border border-slate-200 space-y-3">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-bold">{item.name}</h3>
                                    <p className="text-xl font-mono bg-slate-100 px-3 py-1 rounded-md">{item.currentStockKg.toFixed(3)}<span className="text-sm text-slate-500">kg</span></p>
                                </div>
                                <p className="text-sm text-slate-500">${item.pricePerKgUSD.toFixed(2)} / kg</p>
                                <div className="flex space-x-2">
                                    <button onClick={() => { setSelectedStockItem(item); setSaleModalOpen(true); }} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg transition-colors">Sale</button>
                                    <button onClick={() => { setSelectedStockItem(item); setAddStockModalOpen(true); }} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded-lg transition-colors">Add Stock</button>
                                </div>
                            </div>
                        ))}
                         <button onClick={() => setNewItemModalOpen(true)} className="bg-white p-4 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-500 hover:border-slate-400 hover:text-slate-600 transition-colors">
                            <PlusCircleIcon className="w-12 h-12"/>
                            <span className="mt-2 font-semibold">Add New Meat Type</span>
                        </button>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-slate-200">
                        <h2 className="text-xl font-bold mb-4">History</h2>
                        <div className="max-h-80 overflow-y-auto">
                            <ul className="divide-y divide-slate-100">
                                {appState.stockHistory.map(h => (
                                    <li key={h.id} className="py-3">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <span className={`font-bold text-sm ${h.type === 'sale' ? 'text-red-500' : 'text-green-600'}`}>{h.type.toUpperCase()}</span>
                                                <span className="ml-2 font-medium">{h.stockItemName}</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-mono">{h.type !== 'initial' ? (h.amountKg > 0 ? (h.type === 'sale' ? '-' : '+') : '') : ''}{h.amountKg.toFixed(3)} kg</p>
                                                {h.amountUSD && <p className="text-xs text-slate-500">${h.amountUSD.toFixed(2)}</p>}
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">{new Date(h.date).toLocaleString()}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {isSaleModalOpen && selectedStockItem && <StockSaleModal item={selectedStockItem} onClose={() => setSaleModalOpen(false)} onSale={handleSale} />}
                    {isAddStockModalOpen && selectedStockItem && <AddStockModal item={selectedStockItem} onClose={() => setAddStockModalOpen(false)} onAddStock={handleAddStock} />}
                    {isNewItemModalOpen && <NewItemModal onClose={() => setNewItemModalOpen(false)} onAddItem={addStockItem} />}
                </div>
            )}
        </div>
    );
};

// --- Modals ---
const Modal = ({ children, onClose, title }: { children: ReactNode, onClose: () => void, title: string }) => (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-full overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-slate-200">
                <h3 className="text-xl font-bold">{title}</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><XIcon className="w-6 h-6" /></button>
            </div>
            <div className="p-6">{children}</div>
        </div>
    </div>
);

const ImageModal = ({ imageUrl, onClose }: { imageUrl: string, onClose: () => void }) => (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={onClose}>
        <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img src={imageUrl} alt="Full size task attachment" className="rounded-lg object-contain max-w-full max-h-[90vh]" />
            <button onClick={onClose} className="absolute -top-3 -right-3 bg-white rounded-full p-1.5 text-slate-800 shadow-lg hover:bg-slate-200 transition-colors">
                <XIcon className="w-6 h-6" />
            </button>
        </div>
    </div>
);


const StockSaleModal = ({ item, onClose, onSale }: { item: StockItem, onClose: () => void, onSale: (itemId: string, saleUSD: number) => void }) => {
    const [saleUSD, setSaleUSD] = useState('');
    const kgsSold = saleUSD && item.pricePerKgUSD > 0 ? (parseFloat(saleUSD) / item.pricePerKgUSD) : 0;
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (parseFloat(saleUSD) > 0) {
            onSale(item.id, parseFloat(saleUSD));
            onClose();
        }
    };
    
    return (
        <Modal onClose={onClose} title={`Record Sale for ${item.name}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-600">Sale Amount (USD)</label>
                    <input type="number" step="0.01" value={saleUSD} onChange={e => setSaleUSD(e.target.value)} required className="mt-1 block w-full bg-slate-100 border-slate-300 rounded-md shadow-sm focus:ring-slate-800 focus:border-slate-800" />
                </div>
                 <div className="p-3 bg-slate-100 rounded-md text-sm">
                    <p>Equivalent KGs: <span className="font-bold font-mono">{kgsSold.toFixed(3)} kg</span></p>
                    <p>Remaining Stock: <span className="font-bold font-mono">{(item.currentStockKg - kgsSold).toFixed(3)} kg</span></p>
                </div>
                <button type="submit" className="w-full bg-slate-800 text-white font-bold py-2 px-4 rounded-lg">Confirm Sale</button>
            </form>
        </Modal>
    );
};

const AddStockModal = ({ item, onClose, onAddStock }: { item: StockItem, onClose: () => void, onAddStock: (itemId: string, amountKg: number) => void }) => {
    const [amountKg, setAmountKg] = useState('');
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (parseFloat(amountKg) > 0) {
            onAddStock(item.id, parseFloat(amountKg));
            onClose();
        }
    };
    
    return (
        <Modal onClose={onClose} title={`Add Stock for ${item.name}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-600">Amount (kg)</label>
                    <input type="number" step="0.001" value={amountKg} onChange={e => setAmountKg(e.target.value)} required className="mt-1 block w-full bg-slate-100 border-slate-300 rounded-md shadow-sm focus:ring-slate-800 focus:border-slate-800" />
                </div>
                <button type="submit" className="w-full bg-slate-800 text-white font-bold py-2 px-4 rounded-lg">Add Stock</button>
            </form>
        </Modal>
    );
};

const NewItemModal = ({ onClose, onAddItem }: { onClose: () => void, onAddItem: (item: Omit<StockItem, 'id'>) => void }) => {
    const [name, setName] = useState('');
    const [initialStockKg, setInitialStockKg] = useState('');
    const [pricePerKgUSD, setPricePerKgUSD] = useState('');
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAddItem({
            name,
            currentStockKg: parseFloat(initialStockKg) || 0,
            pricePerKgUSD: parseFloat(pricePerKgUSD) || 0,
        });
        onClose();
    };
    
    return (
        <Modal onClose={onClose} title="Add New Meat Type">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium">Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full bg-slate-100 border-slate-300 rounded-md shadow-sm focus:ring-slate-800 focus:border-slate-800" />
                </div>
                 <div>
                    <label className="block text-sm font-medium">Initial Stock (kg)</label>
                    <input type="number" step="0.001" value={initialStockKg} onChange={e => setInitialStockKg(e.target.value)} className="mt-1 block w-full bg-slate-100 border-slate-300 rounded-md shadow-sm focus:ring-slate-800 focus:border-slate-800" />
                </div>
                 <div>
                    <label className="block text-sm font-medium">Price per kg (USD)</label>
                    <input type="number" step="0.01" value={pricePerKgUSD} onChange={e => setPricePerKgUSD(e.target.value)} className="mt-1 block w-full bg-slate-100 border-slate-300 rounded-md shadow-sm focus:ring-slate-800 focus:border-slate-800" />
                </div>
                <button type="submit" className="w-full bg-slate-800 text-white font-bold py-2 px-4 rounded-lg">Add Item</button>
            </form>
        </Modal>
    );
};

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, children }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, title: string, children: ReactNode }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-full">
                <div className="flex justify-between items-center p-4 border-b border-slate-200">
                    <h3 className="text-xl font-bold">{title}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><XIcon className="w-6 h-6" /></button>
                </div>
                <div className="p-6 space-y-4">
                    {children}
                </div>
                <div className="flex justify-end gap-3 p-4 bg-slate-50 rounded-b-xl">
                    <button onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-4 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button onClick={onConfirm} className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

const UserAddTaskModal = ({ onClose, onAddTask }: { onClose: () => void, onAddTask: (data: { title: string, description: string }) => void }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title) return;
        onAddTask({ title, description });
    };

    return (
        <Modal onClose={onClose} title="Add Your Task">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium">Title</label>
                    <input type="text" placeholder="Task Title (required)" value={title} onChange={e => setTitle(e.target.value)} required className="mt-1 block w-full bg-slate-100 p-2 rounded-md"/>
                </div>
                <div>
                    <label className="block text-sm font-medium">Description (optional)</label>
                    <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className="mt-1 block w-full bg-slate-100 p-2 rounded-md"/>
                </div>
                <button type="submit" className="w-full bg-slate-800 text-white font-bold py-3 px-4 rounded-lg">Add Task</button>
            </form>
        </Modal>
    );
};

const TaskDetailModal = ({ task, onClose }: { task: Task, onClose: () => void }) => {
    const { updateTaskNotes } = useAppContext();
    const [notes, setNotes] = useState(task.notes || '');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    useEffect(() => {
        if (notes === (task.notes || '')) {
            setSaveStatus('idle');
            return;
        }
        
        setSaveStatus('saving');
        const handler = setTimeout(() => {
            updateTaskNotes(task.id, notes);
            setSaveStatus('saved');
            
            const savedTimeout = setTimeout(() => setSaveStatus('idle'), 2000);
            return () => clearTimeout(savedTimeout);

        }, 500); // 500ms debounce

        return () => {
            clearTimeout(handler);
        };
    }, [notes, task.id, task.notes, updateTaskNotes]);

    return (
        <Modal onClose={onClose} title="Task Details">
            <div className="space-y-4">
                <h2 className="text-2xl font-bold">{task.title}</h2>
                {task.description && <p className="text-slate-600">{task.description}</p>}
                
                <div className="text-sm text-slate-500 flex items-center gap-4">
                     <span className="flex items-center gap-1.5"><CalendarIcon className="w-4 h-4"/> {new Date(task.dueDate).toLocaleDateString('en-GB')}</span>
                     {task.time && <span className="flex items-center gap-1.5"><ClockIcon className="w-4 h-4"/> {task.time}</span>}
                </div>
                
                {task.imageUrl && <img src={task.imageUrl} alt="Task" className="rounded-lg max-h-60 w-full object-cover"/>}

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add notes..."
                        className="w-full h-32 p-2 bg-slate-100 rounded-md border-slate-300 focus:ring-slate-800 focus:border-slate-800"
                    />
                    <div className="text-right text-xs text-slate-400 h-4 mt-1">
                        {saveStatus === 'saving' && <span>Saving...</span>}
                        {saveStatus === 'saved' && <span className="text-green-600">Saved!</span>}
                    </div>
                </div>
            </div>
        </Modal>
    );
};


const BroilersPage = () => {
    const { appState, addFlock, addDailyLog } = useAppContext();
    const [isAddFlockModalOpen, setAddFlockModalOpen] = useState(false);
    const [isAddLogModalOpen, setAddLogModalOpen] = useState(false);
    const [selectedFlock, setSelectedFlock] = useState<Flock | null>(null);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-900">Broiler Management</h1>
                <button onClick={() => setAddFlockModalOpen(true)} className="bg-slate-800 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><PlusCircleIcon className="w-5 h-5"/> New Flock</button>
            </div>

            <div className="space-y-4">
                {appState.flocks.length === 0 && <p className="text-slate-500 text-center py-10 bg-white rounded-lg border">No flocks have been added yet.</p>}
                {appState.flocks.map(flock => (
                    <div key={flock.id} className="bg-white p-4 rounded-lg border border-slate-200">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold">{flock.name}</h2>
                                <p className="text-sm text-slate-500">Placed: {new Date(flock.placementDate).toLocaleDateString()}</p>
                                <p className="text-sm text-slate-500">Bird Count: {flock.birdCount}</p>
                            </div>
                            <button onClick={() => { setSelectedFlock(flock); setAddLogModalOpen(true); }} className="bg-slate-100 text-slate-700 font-semibold py-2 px-3 rounded-lg">Add Daily Log</button>
                        </div>
                        <div className="mt-4">
                            <h3 className="font-semibold mb-2">Recent Logs:</h3>
                            {flock.dailyLogs.length > 0 ? (
                                <ul className="text-sm space-y-1">
                                    {flock.dailyLogs.slice(0, 3).map(log => (
                                        <li key={log.id} className="flex justify-between bg-slate-50 p-2 rounded-md">
                                            <span>{new Date(log.date).toLocaleDateString()}</span>
                                            <span>Mortality: {log.mortalityCount}</span>
                                            <span>Avg Wt: {log.averageWeightKg}kg</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (<p className="text-sm text-slate-500">No daily logs recorded yet.</p>)}
                        </div>
                    </div>
                ))}
            </div>

            {isAddFlockModalOpen && <AddFlockModal onClose={() => setAddFlockModalOpen(false)} onAddFlock={addFlock} />}
            {isAddLogModalOpen && selectedFlock && <AddDailyLogModal flock={selectedFlock} onClose={() => setAddLogModalOpen(false)} onAddLog={addDailyLog} />}
        </div>
    );
};

// Modals for Broilers Page
const AddFlockModal = ({ onClose, onAddFlock }: { onClose: () => void, onAddFlock: (flock: Omit<Flock, 'id' | 'dailyLogs'>) => void }) => {
    const [name, setName] = useState('');
    const [placementDate, setPlacementDate] = useState(getTodayDateString());
    const [birdCount, setBirdCount] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAddFlock({ name, placementDate, birdCount: parseInt(birdCount) });
        onClose();
    };

    return (
        <Modal onClose={onClose} title="Add New Flock">
            <form onSubmit={handleSubmit} className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium">Flock Name/ID</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full bg-slate-100 rounded-md"/>
                </div>
                 <div>
                    <label className="block text-sm font-medium">Placement Date</label>
                    <input type="date" value={placementDate} onChange={e => setPlacementDate(e.target.value)} required className="mt-1 block w-full bg-slate-100 rounded-md"/>
                </div>
                 <div>
                    <label className="block text-sm font-medium">Initial Bird Count</label>
                    <input type="number" value={birdCount} onChange={e => setBirdCount(e.target.value)} required className="mt-1 block w-full bg-slate-100 rounded-md"/>
                </div>
                <button type="submit" className="w-full bg-slate-800 text-white font-bold py-2 px-4 rounded-lg">Add Flock</button>
            </form>
        </Modal>
    );
};

const AddDailyLogModal = ({ flock, onClose, onAddLog }: { flock: Flock, onClose: () => void, onAddLog: (flockId: string, log: Omit<DailyLog, 'id'>) => void }) => {
    const [log, setLog] = useState<Omit<DailyLog, 'id'>>({
        date: getTodayDateString(), feedConsumptionKg: 0, waterConsumptionL: 0, mortalityCount: 0, averageWeightKg: 0, temperatureCelsius: 0, notes: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setLog(prev => ({...prev, [name]: name === 'date' || name === 'notes' ? value : parseFloat(value) || 0 }));
    };

    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onAddLog(flock.id, log); onClose(); };

    return (
        <Modal onClose={onClose} title={`Add Daily Log for ${flock.name}`}>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><input type="date" name="date" value={log.date} onChange={handleChange} className="block w-full bg-slate-100 rounded-md"/></div>
                <div><input type="number" name="feedConsumptionKg" placeholder="Feed (kg)" onChange={handleChange} className="block w-full bg-slate-100 rounded-md"/></div>
                <div><input type="number" name="waterConsumptionL" placeholder="Water (L)" onChange={handleChange} className="block w-full bg-slate-100 rounded-md"/></div>
                <div><input type="number" name="mortalityCount" placeholder="Mortality Count" onChange={handleChange} className="block w-full bg-slate-100 rounded-md"/></div>
                <div><input type="number" step="0.01" name="averageWeightKg" placeholder="Avg Weight (kg)" onChange={handleChange} className="block w-full bg-slate-100 rounded-md"/></div>
                <div className="col-span-2"><input type="number" step="0.1" name="temperatureCelsius" placeholder="Temp (°C)" onChange={handleChange} className="block w-full bg-slate-100 rounded-md"/></div>
                <div className="col-span-2"><textarea name="notes" placeholder="Notes..." onChange={handleChange} className="block w-full bg-slate-100 rounded-md"/></div>
                <div className="col-span-2"><button type="submit" className="w-full bg-slate-800 text-white font-bold py-2 px-4 rounded-lg">Save Log</button></div>
            </form>
        </Modal>
    );
};


const AdminPage = () => {
    const { addTask } = useAppContext();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [team, setTeam] = useState<Team>(Team.Maintenance);
    const [dueDate, setDueDate] = useState(getTodayDateString());
    const [time, setTime] = useState('');
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurringDays, setRecurringDays] = useState<number[]>([]);
    const [recurringEndDate, setRecurringEndDate] = useState('');
    const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);

    const handleRecurringDayChange = (day: number) => {
        setRecurringDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
    };
    
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setImageUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title) return;
        addTask({ title, description, team, dueDate, time, isRecurring, recurringDays, recurringEndDate, imageUrl, addedBy: 'admin' });
        setTitle(''); setDescription(''); setTime(''); setImageUrl(undefined);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-slate-900">Admin Panel</h1>
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg border border-slate-200 max-w-2xl mx-auto space-y-4">
                <h2 className="text-xl font-bold">Add New Task</h2>
                <input type="text" placeholder="Task Title (required)" value={title} onChange={e => setTitle(e.target.value)} required className="w-full bg-slate-100 p-2 rounded-md"/>
                <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-slate-100 p-2 rounded-md"/>
                <select value={team} onChange={e => setTeam(e.target.value as Team)} className="w-full bg-slate-100 p-2 rounded-md">
                    <option value={Team.Maintenance}>Maintenance</option>
                    <option value={Team.Butchery}>Butchery</option>
                </select>
                <div className="flex gap-4">
                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full bg-slate-100 p-2 rounded-md"/>
                    <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-slate-100 p-2 rounded-md"/>
                </div>
                <div>
                     <label className="block w-full cursor-pointer bg-slate-100 p-3 rounded-md text-center text-slate-600 hover:bg-slate-200 transition-colors font-semibold">
                        <span>Upload Image</span>
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden"/>
                    </label>
                    {imageUrl && (
                        <div className="mt-3 relative w-fit">
                            <img src={imageUrl} alt="preview" className="h-32 w-auto rounded-md object-cover" />
                            <button type="button" onClick={() => setImageUrl(undefined)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 leading-none">
                                <XIcon className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="recurring" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-slate-600 focus:ring-slate-500"/>
                    <label htmlFor="recurring">Recurring Task</label>
                </div>
                {isRecurring && (
                    <div className="p-4 bg-slate-100 rounded-md space-y-3">
                        <div className="flex justify-around">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                                <label key={day} className="flex flex-col items-center gap-1 text-sm font-medium">
                                    {day}
                                    <input type="checkbox" checked={recurringDays.includes(i + 1)} onChange={() => handleRecurringDayChange(i + 1)} className="h-4 w-4 rounded border-gray-300 text-slate-600 focus:ring-slate-500"/>
                                </label>
                            ))}
                        </div>
                        <input type="date" placeholder="End Date" value={recurringEndDate} onChange={e => setRecurringEndDate(e.target.value)} className="w-full bg-white p-2 rounded-md"/>
                    </div>
                )}
                <button type="submit" className="w-full bg-slate-800 text-white font-bold py-3 px-4 rounded-lg">Add Task</button>
            </form>
        </div>
    );
};

// --- New Layout Components ---

const Sidebar = ({ currentPage, setCurrentPage }: { currentPage: Page, setCurrentPage: (page: Page) => void }) => {
    const navItems = [
        { page: Page.Home, icon: HomeIcon, label: 'Home' },
        { page: Page.Butchery, icon: ButcheryIcon, label: 'Butchery' },
        { page: Page.Maintenance, icon: MaintenanceIcon, label: 'Maintenance' },
        { page: Page.Broilers, icon: BroilerIcon, label: 'Broilers' },
    ];
    
    return (
        <aside className="hidden md:flex w-64 flex-shrink-0 bg-white border-r border-slate-200 flex-col p-4">
            <h1 className="text-2xl font-bold text-slate-800 px-2 mb-6">Royal Palms</h1>
            <nav className="flex-1 space-y-2">
                {navItems.map(item => (
                    <button key={item.page} onClick={() => setCurrentPage(item.page)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left font-semibold transition-colors ${currentPage === item.page ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>
                        <item.icon className="w-5 h-5" />
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>
            <div className="mt-auto space-y-2">
                 <button onClick={() => setCurrentPage(Page.Admin)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left font-semibold transition-colors ${currentPage === Page.Admin ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>
                    <AdminIcon className="w-5 h-5"/>
                    <span>Admin</span>
                </button>
            </div>
        </aside>
    );
};

const handleExport = (callback?: () => void) => {
    const { jsPDF } = window.jspdf || {};
    const html2canvas = window.html2canvas;
    const content = document.getElementById('page-content');
    if (content && jsPDF && html2canvas) {
        html2canvas(content, { scale: 2 }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`RoyalPalms_Export_${new Date().toISOString().split('T')[0]}.pdf`);
        });
    } else {
        console.error("PDF export libraries not loaded yet.");
        alert("Could not export to PDF. Please try again in a moment.");
    }
    if (callback) callback();
};

const Header = ({ currentPage }: { currentPage: Page }) => {
    const [isMenuOpen, setMenuOpen] = useState(false);

    return (
        <header className="flex-shrink-0 bg-white border-b border-slate-200">
            <div className="flex items-center justify-between p-4 h-16">
                <h1 className="md:hidden text-xl font-bold text-slate-900">{currentPage}</h1>

                {/* Search Bar Placeholder */}
                <div className="hidden md:block w-96">
                    {/* Future search bar can go here */}
                </div>

                <div className="relative">
                    <button onClick={() => setMenuOpen(prev => !prev)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                        <span className="font-bold text-slate-600">RP</span>
                    </button>
                    {isMenuOpen && (
                        <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-2 z-20 border border-slate-200">
                            <button onClick={() => handleExport(() => setMenuOpen(false))} className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-slate-100 text-slate-700">
                                <ExportIcon className="w-5 h-5"/> Export PDF
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

const BottomNav = ({ currentPage, setCurrentPage }: { currentPage: Page, setCurrentPage: (page: Page) => void }) => {
    const navItems = [
        { page: Page.Home, icon: HomeIcon, label: 'Home' },
        { page: Page.Butchery, icon: ButcheryIcon, label: 'Butchery' },
        { page: Page.Maintenance, icon: MaintenanceIcon, label: 'Maintenance' },
        { page: Page.Broilers, icon: BroilerIcon, label: 'Broilers' },
    ];
    const [isMoreMenuOpen, setMoreMenuOpen] = useState(false);

    const MoreMenu = () => (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
            <div className="bg-white rounded-t-2xl w-full">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-lg font-bold">More Options</h3>
                    <button onClick={() => setMoreMenuOpen(false)} className="text-slate-400 hover:text-slate-600"><XIcon className="w-6 h-6"/></button>
                </div>
                <div className="p-2">
                    <button onClick={() => { setCurrentPage(Page.Admin); setMoreMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-100 text-slate-700 rounded-lg">
                        <AdminIcon className="w-6 h-6"/> Admin Panel
                    </button>
                    <button onClick={() => handleExport(() => setMoreMenuOpen(false))} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-100 text-slate-700 rounded-lg">
                        <ExportIcon className="w-6 h-6"/> Export as PDF
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around z-40">
                {navItems.map(item => (
                    <button key={item.page} onClick={() => setCurrentPage(item.page)} className={`flex flex-col items-center justify-center p-2 grow transition-colors ${currentPage === item.page ? 'text-slate-800' : 'text-slate-500 hover:text-slate-800'}`}>
                        <item.icon className="w-6 h-6" />
                        <span className="text-xs font-semibold mt-1">{item.label}</span>
                    </button>
                ))}
                <button onClick={() => setMoreMenuOpen(true)} className="flex flex-col items-center justify-center p-2 grow text-slate-500 hover:text-slate-800">
                    <MoreIcon className="w-6 h-6" />
                    <span className="text-xs font-semibold mt-1">More</span>
                </button>
            </nav>
            {isMoreMenuOpen && <MoreMenu />}
        </>
    );
};


export default function App() {
    const [currentPage, setCurrentPage] = useState<Page>(Page.Home);
    
    const renderPage = () => {
        switch (currentPage) {
            case Page.Home: return <HomePage />;
            case Page.Butchery: return <ButcheryPage />;
            case Page.Maintenance: return <MaintenancePage />;
            case Page.Broilers: return <BroilersPage />;
            case Page.Admin: return <AdminPage />;
            default: return <HomePage />;
        }
    };
    
    return (
        <AppProvider>
            <div className="flex h-screen bg-slate-50 text-slate-800 font-sans">
                <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
                <div className="flex-1 flex flex-col overflow-hidden">
                    <Header currentPage={currentPage} />
                    <main id="page-content" className="flex-1 overflow-x-hidden overflow-y-auto p-6 pb-24 md:pb-6">
                        {renderPage()}
                    </main>
                </div>
                <BottomNav currentPage={currentPage} setCurrentPage={setCurrentPage} />
            </div>
        </AppProvider>
    );
}