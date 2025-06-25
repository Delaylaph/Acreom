interface AppState {
    drag: { entityId: string; data: any } | null;
    filterOperation: string;
}

export const state = (): AppState => ({
    drag: null,
    filterOperation: 'overlap',
});

export const getters = {
    dragData: (state: AppState) => {
        return state.drag;
    },
    filterOperation: (state: AppState) => {
        return state.filterOperation;
    },
};

export const mutations = {
    setDrag: (
        state: AppState,
        data: { entityId: string; data: any } | null,
    ) => {
        state.drag = data;
    },
    clearDrag: (state: AppState) => {
        state.drag = null;
    },
    setFilterOperation: (state: AppState, filterOperation: string) => {
        state.filterOperation = filterOperation;
    },
};
