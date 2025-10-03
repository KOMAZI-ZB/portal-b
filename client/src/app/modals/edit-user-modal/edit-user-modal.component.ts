import { Component, Input, OnInit, ViewChild, AfterViewInit, OnDestroy, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { User } from '../../_models/user';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ToastrService } from 'ngx-toastr';
import { FormsModule, NgForm } from '@angular/forms';
import { ConfirmCloseModalComponent } from '../confirm-close-modal/confirm-close-modal.component';

@Component({
  selector: 'app-edit-user-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-user-modal.component.html',
  styleUrls: ['./edit-user-modal.component.css']
})
export class EditUserModalComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() user!: User;
  @Input() bsModalRef!: BsModalRef<EditUserModalComponent>;

  @ViewChild('userForm') userForm?: NgForm;

  roles = ['Admin', 'Student', 'Lecturer', 'Coordinator'];
  selectedRoles: string[] = [];

  firstName = '';
  lastName = '';
  email = '';
  updatePassword = '';
  showPassword = false;

  // ===== live validation state =====
  firstNameError = '';
  lastNameError = '';
  emailError = '';
  passwordError = '';

  // password checklist flags (apply only when updatePassword is non-empty)
  pwMinLen = false;
  pwUpper = false;
  pwLower = false;
  pwDigit = false;
  pwSymbol = false;

  baseUrl = environment.apiUrl;

  private originalHide!: () => void;
  private justSaved = false;

  private modalEl: HTMLElement | null = null;
  private backdropCapture?: (ev: MouseEvent) => void;
  private escCapture?: (ev: KeyboardEvent) => void;

  constructor(
    private http: HttpClient,
    private toastr: ToastrService,
    public modalRef: BsModalRef,
    private bsModalService: BsModalService,
    private elRef: ElementRef<HTMLElement>
  ) { }

  ngOnInit(): void {
    this.firstName = this.user.name;
    this.lastName = this.user.surname;
    this.email = this.user.email;
    this.selectedRoles = [...this.user.roles];

    // pre-validate with current values so Save reflects validity immediately
    this.onFirstNameChange(this.firstName);
    this.onLastNameChange(this.lastName);
    this.onEmailChange(this.email);
    this.onPasswordChange(this.updatePassword);

    const ref = this.bsModalRef ?? this.modalRef;
    this.originalHide = ref.hide.bind(ref);
    ref.hide = () => this.attemptClose();
  }

  ngAfterViewInit(): void {
    const contentEl = this.elRef.nativeElement.closest('.modal-content') as HTMLElement | null;
    const modalEl = contentEl?.closest('.modal') as HTMLElement | null;
    this.modalEl = modalEl;

    if (modalEl) {
      this.backdropCapture = (ev: MouseEvent) => {
        const t = ev.target as Element;
        const insideThisModal = t.closest('.modal') === modalEl;
        const inDialog = !!t.closest('.modal-dialog');
        if (insideThisModal && !inDialog && this.hasUnsavedChanges()) {
          ev.stopPropagation(); ev.preventDefault();
          this.openConfirm().then(discard => { if (discard) this.originalHide(); });
        }
      };
      modalEl.addEventListener('mousedown', this.backdropCapture, true);
    }

    this.escCapture = (ev: KeyboardEvent) => {
      if ((ev.key === 'Escape' || ev.key === 'Esc') && this.hasUnsavedChanges()) {
        ev.stopPropagation(); ev.preventDefault();
        this.openConfirm().then(discard => { if (discard) this.originalHide(); });
      }
    };
    document.addEventListener('keydown', this.escCapture, true);
  }

  ngOnDestroy(): void {
    if (this.modalEl && this.backdropCapture) this.modalEl.removeEventListener('mousedown', this.backdropCapture, true);
    if (this.escCapture) document.removeEventListener('keydown', this.escCapture, true);
  }

  private hasUnsavedChanges(): boolean {
    if (this.justSaved) return false;
    return !!this.userForm?.dirty;
  }

  private openConfirm(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.bsModalService.show(ConfirmCloseModalComponent, {
        class: 'modal-dialog-centered',
        initialState: { onStay: () => resolve(false), onDiscard: () => resolve(true) }
      });
    });
  }

  async attemptClose() {
    if (this.hasUnsavedChanges()) {
      const discard = await this.openConfirm();
      if (!discard) return;
    }
    this.originalHide();
  }

  toggleRole(role: string, event: any) {
    if (event.target.checked) {
      if (!this.selectedRoles.includes(role)) this.selectedRoles.push(role);
    } else {
      this.selectedRoles = this.selectedRoles.filter(r => r !== role);
    }
  }

  togglePasswordVisibility() { this.showPassword = !this.showPassword; }

  // ===== validators (mirror Add User rules) =====
  private nameValidPattern(value: string): boolean {
    // Letters (any case), spaces, hyphens, apostrophes; must start with a letter
    return /^[A-Za-z][A-Za-z\s'-]*$/.test((value ?? '').trim());
  }

  onFirstNameChange(value: string) {
    this.firstName = value ?? '';
    if (!this.firstName.trim()) {
      this.firstNameError = 'First name is required.';
    } else if (!this.nameValidPattern(this.firstName)) {
      this.firstNameError = 'First name must contain letters only.';
    } else {
      this.firstNameError = '';
    }
  }

  onLastNameChange(value: string) {
    this.lastName = value ?? '';
    if (!this.lastName.trim()) {
      this.lastNameError = 'Last name is required.';
    } else if (!this.nameValidPattern(this.lastName)) {
      this.lastNameError = 'Last name must contain letters only.';
    } else {
      this.lastNameError = '';
    }
  }

  private emailDomainValid(value: string): boolean {
    const v = (value ?? '').trim().toLowerCase();
    return v.endsWith('@ufs4life.ac.za') || v.endsWith('@gmail.com');
  }

  onEmailChange(value: string) {
    this.email = value ?? '';
    const emailBasic = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim());

    if (!this.email.trim()) {
      this.emailError = 'Email is required.';
    } else if (!emailBasic || !this.emailDomainValid(this.email)) {
      this.emailError = 'Use a valid email ending with @ufs4life.ac.za or @gmail.com.';
    } else {
      this.emailError = '';
    }
  }

  onPasswordChange(value: string) {
    this.updatePassword = value ?? '';

    // Reset flags when empty (password is optional on edit)
    if (!this.updatePassword) {
      this.pwMinLen = this.pwUpper = this.pwLower = this.pwDigit = this.pwSymbol = false;
      this.passwordError = '';
      return;
    }

    this.pwMinLen = this.updatePassword.length >= 8;
    this.pwUpper = /[A-Z]/.test(this.updatePassword);
    this.pwLower = /[a-z]/.test(this.updatePassword);
    this.pwDigit = /\d/.test(this.updatePassword);
    this.pwSymbol = /[^A-Za-z0-9]/.test(this.updatePassword);

    if (!(this.pwMinLen && this.pwUpper && this.pwLower && this.pwDigit && this.pwSymbol)) {
      this.passwordError = 'Password does not meet all requirements.';
    } else {
      this.passwordError = '';
    }
  }

  get formValid(): boolean {
    const nameOk = !this.firstNameError && !!this.firstName.trim();
    const surnameOk = !this.lastNameError && !!this.lastName.trim();
    const emailOk = !this.emailError && !!this.email.trim();
    // password optional; if provided it must meet all rules
    const pwOk = !this.updatePassword || (
      !this.passwordError && this.pwMinLen && this.pwUpper && this.pwLower && this.pwDigit && this.pwSymbol
    );

    return nameOk && surnameOk && emailOk && pwOk;
  }

  submit() {
    if (!this.formValid) {
      this.toastr.error('Please fix the highlighted fields before saving.');
      return;
    }

    const payload = {
      firstName: this.firstName.trim(),
      lastName: this.lastName.trim(),
      email: this.email.trim().toLowerCase(),
      updatePassword: this.updatePassword || null,   // keep current password if empty
      roles: this.selectedRoles
    };

    this.http.put(`${this.baseUrl}admin/update-user/${this.user.userName}`, payload).subscribe({
      next: () => { this.toastr.success('User updated successfully'); this.justSaved = true; this.originalHide(); },
      error: err => {
        console.error('Update failed:', err);
        const status = err?.status;
        const apiMsg = err?.error?.message;

        if (status === 400) {
          this.toastr.error(apiMsg || 'Invalid field data. Please review the inputs.');
        } else if (status >= 500) {
          this.toastr.error('Server error. Please try again.');
        } else {
          this.toastr.error(apiMsg || 'Failed to update user');
        }
      }
    });
  }

  cancel() { this.attemptClose(); }
}
