import { Role } from "src/user/enum/role.enum";


interface RoleRoute {
    method: string;
    path: string;
    roles: Role[];
}

export const ROLE_BASED_ROUTES: RoleRoute[] = [
    // users
    { method: "GET", path: "/users/profile", roles: [Role.SUPER_ADMIN, Role.CLIENT_ADMIN, Role.CONSULTANT, Role.TRAINER] },
    { method: "POST", path: "/users", roles: [Role.SUPER_ADMIN] },
    { method: "PUT", path: "/users/:id", roles: [Role.SUPER_ADMIN] },
    { method: "DELETE", path: "/users/:id", roles: [Role.SUPER_ADMIN] },
    { method: "POST", path: "/users/search", roles: [Role.SUPER_ADMIN, Role.CLIENT_ADMIN, Role.CONSULTANT] },
    { method: "POST", path: "/users/find-all", roles: [Role.SUPER_ADMIN, Role.CLIENT_ADMIN, Role.CONSULTANT] },
    { method: "GET", path: "/users/role-counts", roles: [Role.SUPER_ADMIN, Role.CLIENT_ADMIN, Role.CONSULTANT] },
    { method: "PATCH", path: "/users/:id/toggle-status", roles: [Role.SUPER_ADMIN] },
    { method: "GET", path: "/users/id/:id", roles: [Role.SUPER_ADMIN, Role.CLIENT_ADMIN, Role.CONSULTANT] },
    { method: "GET", path: "/users/email/:email", roles: [Role.SUPER_ADMIN, Role.CLIENT_ADMIN, Role.CONSULTANT] },
    { method: "PATCH", path: "/users/:id", roles: [Role.SUPER_ADMIN] },
];
