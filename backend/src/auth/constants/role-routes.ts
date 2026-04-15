import { Role } from "src/user/enum/role.enum";


interface RoleRoute {
    method: string;
    path: string;
    roles: Role[];
}

export const ROLE_BASED_ROUTES: RoleRoute[] = [
    // users
    { method: "GET", path: "/users/profile", roles: [Role.ADMIN, Role.DENTIST, Role.RECEPTIONIST] },
    { method: "POST", path: "/users", roles: [Role.ADMIN] },
    { method: "PUT", path: "/users/:id", roles: [Role.ADMIN] },
    { method: "DELETE", path: "/users/:id", roles: [Role.ADMIN] },
    { method: "POST", path: "/users/search", roles: [Role.ADMIN, Role.DENTIST, Role.RECEPTIONIST] },
    { method: "POST", path: "/users/find-all", roles: [Role.ADMIN, Role.DENTIST, Role.RECEPTIONIST] },
    { method: "GET", path: "/users/role-counts", roles: [Role.ADMIN, Role.DENTIST, Role.RECEPTIONIST] },
    { method: "PATCH", path: "/users/:id/toggle-status", roles: [Role.ADMIN] },
    { method: "GET", path: "/users/id/:id", roles: [Role.ADMIN, Role.DENTIST, Role.RECEPTIONIST] },
    { method: "GET", path: "/users/email/:email", roles: [Role.ADMIN, Role.DENTIST, Role.RECEPTIONIST] },
    { method: "PATCH", path: "/users/:id", roles: [Role.ADMIN] },
    
    // session management (auth routes)
    { method: "GET", path: "/auth/sessions", roles: [Role.ADMIN, Role.DENTIST, Role.RECEPTIONIST] },
    { method: "DELETE", path: "/auth/sessions/:id", roles: [Role.ADMIN, Role.DENTIST, Role.RECEPTIONIST] },
    { method: "POST", path: "/auth/sessions/revoke-all", roles: [Role.ADMIN, Role.DENTIST, Role.RECEPTIONIST] },

    // patients
    { method: "POST", path: "/patients", roles: [Role.ADMIN, Role.DENTIST, Role.RECEPTIONIST] },
    { method: "GET", path: "/patients", roles: [Role.ADMIN, Role.DENTIST, Role.RECEPTIONIST] },
    { method: "GET", path: "/patients/check-phone/:phone", roles: [Role.ADMIN, Role.DENTIST, Role.RECEPTIONIST] },
    { method: "GET", path: "/patients/:id", roles: [Role.ADMIN, Role.DENTIST, Role.RECEPTIONIST] },
    { method: "PUT", path: "/patients/:id", roles: [Role.ADMIN, Role.DENTIST, Role.RECEPTIONIST] },
    { method: "PATCH", path: "/patients/:id/toggle-status", roles: [Role.ADMIN, Role.DENTIST, Role.RECEPTIONIST] },
    { method: "DELETE", path: "/patients/:id", roles: [Role.ADMIN, Role.DENTIST, Role.RECEPTIONIST] },
    { method: "POST", path: "/patients/search", roles: [Role.ADMIN, Role.DENTIST, Role.RECEPTIONIST] },
    { method: "POST", path: "/patients/find-all", roles: [Role.ADMIN, Role.DENTIST, Role.RECEPTIONIST] },
    { method: "GET", path: "/patients/role-counts", roles: [Role.ADMIN, Role.DENTIST, Role.RECEPTIONIST] },
    { method: "PATCH", path: "/patients/:id", roles: [Role.ADMIN, Role.DENTIST, Role.RECEPTIONIST] },

];
