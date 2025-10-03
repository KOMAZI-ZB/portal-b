// src/app/_guards/nonadmin.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AccountService } from '../_services/account.service';
import { ToastrService } from 'ngx-toastr';

export const nonadminGuard: CanActivateFn = () => {
  const accountService = inject(AccountService);
  const toastr = inject(ToastrService);

  const roles = accountService.roles();
  const user = accountService.currentUser();
  const hasModules = (user?.modules ?? []).length > 0;

  const isStudent = roles.includes('Student');
  const isLecturerWithModules = roles.includes('Lecturer') && hasModules;
  const isCoordinatorWithModules = roles.includes('Coordinator') && hasModules;

  if (isStudent || isLecturerWithModules || isCoordinatorWithModules) {
    return true;
  }

  toastr.error('Only students, lecturers or coordinators with modules can access this page');
  return false;
};
