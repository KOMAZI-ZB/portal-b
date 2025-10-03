import { Module } from './module';

export interface User {
    userName: string;
    name: string;
    surname: string;
    email: string;
    token: string;
    roles: string[];
    modules: Module[]; //   This line fixes the error
}
