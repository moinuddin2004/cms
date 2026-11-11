/** Every API response is wrapped by the backend's `ResponseWrapper`. */
export interface ApiResponse<T> {
  data: T;
  message?: string;
  isSuccess: boolean;
  httpStatusCode: number;
}

/** Paged list payload (`data` of an `ApiResponse`). */
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
