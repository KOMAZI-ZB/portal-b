import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AccountService } from '../_services/account.service';

export const lecturerGuard: CanActivateFn = () => {
  const accountService = inject(AccountService);
  const toastr = inject(ToastrService);

  const roles = accountService.roles();
  const user = accountService.currentUser();
  const hasModules = (user?.modules ?? []).length > 0;

  const isLecturer = roles.includes('Lecturer');
  const isCoordinatorWithModules = roles.includes('Coordinator') && hasModules;

  if (isLecturer || isCoordinatorWithModules) {
    return true;
  }

  toastr.error('Only lecturers or coordinators with modules can access this page');
  return false;
};
