// src/app/_guards/admin.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AccountService } from '../_services/account.service';

export const adminGuard: CanActivateFn = (route, state) => {
  const accountService = inject(AccountService);
  const toastr = inject(ToastrService);

  const roles = accountService.roles(); // ⛔ signal evaluation happens once here

  //   Check if roles contain "Admin"
  const hasAdmin = Array.isArray(roles) ? roles.includes('Admin') : roles === 'Admin';

  if (hasAdmin) {
    return true;
  } else {
    toastr.error('You cannot enter this area');
    return false;
  }
};
