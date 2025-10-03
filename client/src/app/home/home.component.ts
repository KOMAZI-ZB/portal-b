import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountService } from '../_services/account.service';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  imports: [CommonModule, FormsModule]
})
export class HomeComponent {
  private accountService = inject(AccountService);
  private router = inject(Router);
  private toastr = inject(ToastrService); // Optional

  model: any = {};
  showPassword = false;
  userNameError = '';
  passwordError = '';

  login() {
    this.userNameError = '';
    this.passwordError = '';

    this.accountService.login(this.model).subscribe({
      next: () => {
        const role = this.accountService.getUserRole();
        this.router.navigateByUrl(role === 'Admin' ? '/admin' : '/notifications');
      },
      error: error => {
        const errObj = error?.error;
        if (typeof errObj === 'object') {
          this.userNameError = errObj?.userName || '';
          this.passwordError = errObj?.password || '';
        }
      }
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }
}
