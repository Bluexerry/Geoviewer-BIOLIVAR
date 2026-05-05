import apiClient from './api.client';

const authService = {
    login: async (username, password) => {
        const { data } = await apiClient.post('/login', { username, password });
        return {
            userId: data.message[0],
            token: data.message[1],
        };
    },

    getUserParcels: async (userId) => {
        const { data } = await apiClient.get(`/users/${userId}/parcels`);
        return data;
    },
};

export default authService;
