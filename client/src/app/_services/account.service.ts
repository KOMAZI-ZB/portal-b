// src/app/_services/account.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { User } from '../_models/user';
import { map } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AccountService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  currentUser = signal<User | null>(null);

  // Holds the pending auto-logout timer so it can be cleared/reset.
  private logoutTimer: any = null;

  roles = computed(() => {
    const user = this.currentUser();
    if (!user?.token) return [];
    try {
      const payload = JSON.parse(atob(user.token.split('.')[1]));
      const extracted = payload.role || payload.roles || [];
      return Array.isArray(extracted) ? extracted : [extracted];
    } catch (e) {
      console.error('Failed to decode JWT roles:', e);
      return [];
    }
  });

  getUserRole(): string {
    const roles = this.roles();
    return roles.length > 0 ? roles[0] : '';
  }

  // Helper to check if user has modules (used for nav visibility)
  hasModules(): boolean {
    return (this.currentUser()?.modules ?? []).length > 0;
  }

  // Alias if you still call this elsewhere
  getUserHasModules(): boolean {
    return this.hasModules();
  }

  login(model: any) {
    return this.http.post<User>(this.baseUrl + 'account/login', model).pipe(
      map(user => {
        if (user) this.setCurrentUser(user);
        return user;
      })
    );
  }

  /**
   * Store user in sessionStorage (not localStorage), validate token expiry,
   * and set a timer to auto-logout at exact expiry.
   */
  setCurrentUser(user: User) {
    // Validate token before storing
    const expiryMs = this.getTokenExpiryMs(user?.token);
    const now = Date.now();

    if (!expiryMs || expiryMs <= now) {
      // Token already expired or invalid -> ensure logout state.
      this.clearStorage();
      this.currentUser.set(null);
      this.clearLogoutTimer();
      return;
    }

    // Persist only for this session (ends when the app/browser closes).
    sessionStorage.setItem('user', JSON.stringify(user));
    this.currentUser.set(user);

    // (Re)start auto-logout timer
    this.startAutoLogoutTimer(expiryMs - now);
  }

  logout() {
    this.clearStorage();
    this.currentUser.set(null);
    this.clearLogoutTimer();
  }

  // ===== Helpers for token expiry & timers =====

  private getTokenExpiryMs(token?: string | null): number | null {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // exp is in seconds since epoch; convert to ms
      return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    } catch (e) {
      console.error('Failed to decode JWT exp:', e);
      return null;
    }
  }

  private startAutoLogoutTimer(timeoutMs: number) {
    this.clearLogoutTimer();
    // Guard: if somehow negative/too small, log out immediately.
    if (timeoutMs <= 0) {
      this.logout();
      return;
    }
    this.logoutTimer = setTimeout(() => {
      this.logout();
    }, timeoutMs);
  }

  private clearLogoutTimer() {
    if (this.logoutTimer) {
      clearTimeout(this.logoutTimer);
      this.logoutTimer = null;
    }
  }

  private clearStorage() {
    // We intentionally use sessionStorage only now.
    sessionStorage.removeItem('user');
  }
}
