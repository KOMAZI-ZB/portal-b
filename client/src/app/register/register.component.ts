import { Component, OnInit, inject, Output, EventEmitter } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { TextInputComponent } from '../_forms/text-input/text-input.component';
import { AdminService } from '../_services/admin.service'; //   Use AdminService for registration

@Component({
  selector: 'app-register',
  standalone: true,
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'], //   fixed typo
  imports: [ReactiveFormsModule, TextInputComponent]
})
export class RegisterComponent implements OnInit {
  private adminService = inject(AdminService); //   Inject correct service
  private fb = inject(FormBuilder);
  private router = inject(Router);

  @Output() cancelRegister = new EventEmitter<boolean>(); //   Correct output

  registerForm: FormGroup = new FormGroup({});
  validationErrors: string[] | undefined;

  ngOnInit(): void {
    this.initializeForm();
  }

  initializeForm() {
    this.registerForm = this.fb.group({
      userName: ['', [Validators.required]],
      name: ['', Validators.required],
      surname: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required, this.matchValues('password')]],
      role: ['Student', Validators.required] // Student | Lecturer | Coordinator
    });

    this.registerForm.controls['password'].valueChanges.subscribe(() => {
      this.registerForm.controls['confirmPassword'].updateValueAndValidity();
    });
  }

  matchValues(matchTo: string): ValidatorFn {
    return (control: AbstractControl) => {
      return control.value === control.parent?.get(matchTo)?.value
        ? null
        : { isMatching: true };
    };
  }

  register() {
    if (this.registerForm.invalid) return;

    this.adminService.registerUser(this.registerForm.value).subscribe({
      next: _ => this.router.navigateByUrl('/admin'),
      error: error => this.validationErrors = error.error?.errors || [error.message]
    });
  }

  cancel() {
    this.cancelRegister.emit(false);
  }
}
