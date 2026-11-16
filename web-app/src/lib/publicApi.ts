import axios from 'axios'
import { API_BASE_URL } from './api'

/**
 * Client for PUBLIC endpoints (visit page, …): no interceptors, no cookies,
 * no Authorization / tenant headers, and no 401 refresh/redirect handling.
 * The signed-in `api` client must never talk to a public, token-in-URL route.
 */
export const publicApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: false,
})
