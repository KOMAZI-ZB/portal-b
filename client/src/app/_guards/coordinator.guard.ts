import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AccountService } from '../_services/account.service';

export const coordinatorGuard: CanActivateFn = (route, state) => {
  const accountService = inject(AccountService);
  const toastr = inject(ToastrService);

  const roles = accountService.roles();
  const hasAccess = Array.isArray(roles) ? roles.includes('Coordinator') : roles === 'Coordinator';

  if (hasAccess) {
    return true;
  } else {
    toastr.error('Only coordinators can access this page');
    return false;
  }
};
