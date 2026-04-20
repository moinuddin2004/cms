import axios, { type InternalAxiosRequestConfig, AxiosError } from 'axios';
import { useAuthStore } from '@/store/useAuthStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // Always send cookies
});

// ==================== REQUEST INTERCEPTOR ====================
apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const state = useAuthStore.getState();
        const token = state.accessToken;
        
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        
        // Inject tenant context headers
        if (state.activeOrganizationId) {
            config.headers['x-organization-id'] = state.activeOrganizationId;
        }
        
        if (state.activeLocationId) {
            config.headers['x-location-id'] = state.activeLocationId;
        }
        
        return config;
    },
    (error) => Promise.reject(error),
);

// ==================== RESPONSE INTERCEPTOR (AUTO-REFRESH) ====================
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (value: any) => void;
    reject: (error: any) => void;
    config: InternalAxiosRequestConfig;
}> = [];

/**
 * Process the queue of failed requests after a successful refresh.
 */
function processQueue(error: AxiosError | null): void {
    failedQueue.forEach(({ resolve, reject, config }) => {
        if (error) {
            reject(error);
        } else {
            // Retry with the new token
            const token = useAuthStore.getState().accessToken;
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            resolve(apiClient(config));
        }
    });
    failedQueue = [];
}

apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Only handle 401 (Unauthorized) responses
        if (error.response?.status !== 401 || !originalRequest) {
            return Promise.reject(error);
        }

        // Don't retry the refresh endpoint itself
        if (originalRequest.url?.includes('/auth/refresh') || originalRequest.url?.includes('/auth/login')) {
            return Promise.reject(error);
        }

        // Don't retry if already retried
        if (originalRequest._retry) {
            useAuthStore.getState().clearAuth();
            window.location.href = '/login';
            return Promise.reject(error);
        }

        // If a refresh is already in progress, queue this request
        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject, config: originalRequest });
            });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
            // Attempt to refresh the token
            const refreshResponse = await axios.post(
                `${API_BASE_URL}/auth/refresh`,
                {},
                { withCredentials: true },
            );

            const { 
              accessToken, 
              user,
              isSuperAdmin,
              accessSource,
              requiresOrgSelection,
              requiresLocationSelection,
              accessibleOrganizations,
              activeOrganizationId,
              activeLocationId
            } = refreshResponse.data.data;

            // Update store with new token and location context
            useAuthStore.getState().setAuth({ 
              user, 
              accessToken,
              isSuperAdmin,
              accessSource,
              requiresOrgSelection,
              requiresLocationSelection,
              accessibleOrganizations,
              activeOrganizationId,
              activeLocationId
            });

            // Retry queued requests
            processQueue(null);

            // Retry the original request
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return apiClient(originalRequest);
        } catch (refreshError) {
            // Refresh failed — clear auth and redirect
            processQueue(refreshError as AxiosError);
            useAuthStore.getState().clearAuth();
            window.location.href = '/login';
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    },
);

export default apiClient;
