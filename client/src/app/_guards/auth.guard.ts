// src/app/_guards/auth.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AccountService } from '../_services/account.service';

export const authGuard: CanActivateFn = (route, state) => {
  const accountService = inject(AccountService);
  const toastr = inject(ToastrService);

  const user = accountService.currentUser();

  if (user) {
    return true;
  } else {
    toastr.error('You shall not PASS!');
    return false;
  }
};
