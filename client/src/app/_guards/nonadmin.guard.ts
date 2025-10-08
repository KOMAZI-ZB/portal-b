// src/app/_guards/nonadmin.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AccountService } from '../_services/account.service';
import { ToastrService } from 'ngx-toastr';

export const nonadminGuard: CanActivateFn = (route, state) => {
  const accountService = inject(AccountService);
  const toastr = inject(ToastrService);

  const roles = accountService.roles();
  const user = accountService.currentUser();
  const hasModules = (user?.modules ?? []).length > 0;

  const isStudent = roles.includes('Student');
  const isLecturer = roles.includes('Lecturer');
  const isCoordinator = roles.includes('Coordinator');

  const url = state.url || '';

  // Allow Coordinators into Modules even with zero assigned modules
  // Applies to /modules and /modules/:id
  if (url.startsWith('/modules') && isCoordinator) {
    return true;
  }

  // Allow Coordinators into Scheduler even with zero assigned modules
  // Applies to /scheduler and all child routes (/scheduler/lab, /scheduler/class, /scheduler/assessment)
  if (url.startsWith('/scheduler') && isCoordinator) {
    return true;
  }

  // Original behaviour for everyone else:
  // - Students always allowed
  // - Lecturers/Coordinators must have modules for non-Modules pages
  if (isStudent) return true;
  if (isLecturer && hasModules) return true;
  if (isCoordinator && hasModules) return true;

  toastr.error('Only students, lecturers or coordinators with modules can access this page');
  return false;
};
