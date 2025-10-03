import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
import { CollapseModule } from 'ngx-bootstrap/collapse';
import { HasRoleDirective } from '../_directives/has-role.directive';
import { NgIf, NgClass } from '@angular/common';
import { AccountService } from '../_services/account.service';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [
    BsDropdownModule,
    CollapseModule,          // <-- use ngx-bootstrap Collapse
    RouterLink,
    RouterLinkActive,
    HasRoleDirective,
    NgIf,
    NgClass
  ],
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.css']
})
export class NavComponent implements OnInit {
  accountService = inject(AccountService);
  private router = inject(Router);

  hasNewNotification = false;

  // controls the collapsed state of the navbar on small screens
  isCollapsed = true;

  ngOnInit() {
    const seen = localStorage.getItem('notificationsSeen');
    this.hasNewNotification = seen !== 'true';
  }

  logout() {
    this.accountService.logout();
    this.router.navigateByUrl('/');
    this.isCollapsed = true; // close menu after action
  }

  markNotificationsAsSeen() {
    this.hasNewNotification = false;
    localStorage.setItem('notificationsSeen', 'true');
    localStorage.setItem('lastSeenNotification', new Date().toISOString());
  }

  closeNav() {
    this.isCollapsed = true;
  }

  get showLecturerPanel(): boolean {
    const user = this.accountService.currentUser();
    const roles = this.accountService.roles();
    const hasRole = roles.includes('Lecturer') || roles.includes('Coordinator');
    const hasModules = (user?.modules ?? []).length > 0;
    return hasRole && hasModules;
  }

  isAdmin(): boolean {
    return this.accountService.getUserRole() === 'Admin';
  }
}
