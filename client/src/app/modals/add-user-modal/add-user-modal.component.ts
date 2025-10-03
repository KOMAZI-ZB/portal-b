import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { AdminService } from '../../_services/admin.service';
import { ModuleService } from '../../_services/module.service';
import { Module } from '../../_models/module';
import { ToastrService } from 'ngx-toastr';
import { ConfirmCloseModalComponent } from '../confirm-close-modal/confirm-close-modal.component';

type UsernameStatus = 'idle' | 'checking' | 'unique' | 'duplicate' | 'invalid';

@Component({
  selector: 'app-add-user-modal',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './add-user-modal.component.html',
  styleUrls: ['./add-user-modal.component.css']
})
export class AddUserModalComponent implements OnInit, AfterViewInit, OnDestroy {
  constructor(
    private adminService: AdminService,
    private moduleService: ModuleService,
    private toastr: ToastrService,
    public modalRef: BsModalRef,
    private bsModalService: BsModalService,
    private elRef: ElementRef<HTMLElement>
  ) { }

  @ViewChild('usernameInput') usernameInput!: ElementRef<HTMLInputElement>;

  userName = '';
  firstName = '';
  lastName = '';
  email = '';
  password = '';
  role = 'Student';
  showPassword = false;

  semester1Modules: Module[] = [];
  semester2Modules: Module[] = [];

  // Selected IDs
  selectedSemester1: number[] = [];
  selectedSemester2: number[] = [];

  // Track which modules are Year modules to sync both lists
  private yearModuleIds = new Set<number>();

  roles = ['Student', 'Lecturer', 'Coordinator', 'Admin'];

  private originalHide!: () => void;
  private formDirty = false;

  private modalEl: HTMLElement | null = null;
  private backdropCapture?: (ev: MouseEvent) => void;
  private escCapture?: (ev: KeyboardEvent) => void;

  // ===== Real-time validation state =====
  usernameStatus: UsernameStatus = 'idle';
  private usernameDebounce?: any;
  usernameError = '';

  firstNameError = '';
  lastNameError = '';
  emailError = '';

  // Password rule flags
  pwMinLen = false;
  pwUpper = false;
  pwLower = false;
  pwDigit = false;
  pwSymbol = false;
  passwordError = '';

  // ===== Helpers =====
  private sortByCode(a: Module, b: Module) {
    return (a.moduleCode || '').localeCompare(b.moduleCode || '', undefined, { numeric: true, sensitivity: 'base' });
  }

  ngOnInit(): void {
    this.userName = '';
    this.firstName = '';
    this.lastName = '';
    this.email = '';
    this.password = '';

    this.moduleService.getAllModules().subscribe({
      next: modules => {
        // Fill lists (include Year modules in both)
        this.semester1Modules = modules
          .filter(m => m.semester === 1 || m.isYearModule)
          .sort(this.sortByCode.bind(this));

        this.semester2Modules = modules
          .filter(m => m.semester === 2 || m.isYearModule)
          .sort(this.sortByCode.bind(this));

        // Record which IDs are Year modules for sync logic
        this.yearModuleIds = new Set(modules.filter(m => !!m.isYearModule).map(m => m.id));
      }
    });

    this.originalHide = this.modalRef.hide.bind(this.modalRef);
    this.modalRef.hide = () => this.attemptClose();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.usernameInput?.nativeElement.focus(), 0);

    const contentEl = this.elRef.nativeElement.closest('.modal-content') as HTMLElement | null;
    const modalEl = contentEl?.closest('.modal') as HTMLElement | null;
    this.modalEl = modalEl;

    if (modalEl) {
      this.backdropCapture = (ev: MouseEvent) => {
        const t = ev.target as Element;
        const inside = t.closest('.modal') === modalEl;
        const inDialog = !!t.closest('.modal-dialog');
        if (inside && !inDialog && this.formDirty) {
          ev.stopPropagation(); ev.preventDefault();
          this.openConfirm().then(discard => { if (discard) this.originalHide(); });
        }
      };
      modalEl.addEventListener('mousedown', this.backdropCapture, true);
    }

    this.escCapture = (ev: KeyboardEvent) => {
      if ((ev.key === 'Escape' || ev.key === 'Esc') && this.formDirty) {
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

  markDirty() { this.formDirty = true; }
  togglePasswordVisibility() { this.showPassword = !this.showPassword; }

  // Role change should re-validate username rule
  onRoleChange(newRole: string) {
    this.role = newRole;
    this.markDirty();
    this.onUsernameChange(this.userName); // re-run to apply 10-digit rule when needed
  }

  // ===== Live validators =====
  onUsernameChange(value: string) {
    this.markDirty();
    this.userName = (value ?? '').trim();
    this.usernameError = '';
    this.usernameStatus = 'idle';

    if (!this.userName) {
      this.usernameStatus = 'invalid';
      this.usernameError = 'Username is required.';
      return;
    }

    // For non-Admin roles, enforce 10-digit string (do NOT coerce to number)
    const isAdmin = this.role === 'Admin';
    if (!isAdmin && !/^\d{10}$/.test(this.userName)) {
      this.usernameStatus = 'invalid';
      this.usernameError = 'Username must be exactly 10 digits.';
      return; // do not hit API if pattern invalid
    }

    // Debounce uniqueness check
    if (this.usernameDebounce) clearTimeout(this.usernameDebounce);
    this.usernameStatus = 'checking';
    this.usernameDebounce = setTimeout(() => {
      this.adminService.checkUsernameExists(this.userName).subscribe({
        next: res => {
          if (res?.exists) {
            this.usernameStatus = 'duplicate';
            this.usernameError = 'A user with Username already exists.';
          } else {
            this.usernameStatus = 'unique';
            this.usernameError = '';
          }
        },
        error: _ => {
          this.usernameStatus = 'invalid';
          this.usernameError = 'Could not verify username. Check your connection.';
        }
      });
    }, 350);
  }

  private nameValidPattern(value: string): boolean {
    // Letters (any case), spaces, hyphens, apostrophes; must start with a letter
    return /^[A-Za-z][A-Za-z\s'-]*$/.test(value.trim());
  }

  onFirstNameChange(value: string) {
    this.markDirty();
    this.firstName = value;
    if (!this.firstName.trim()) {
      this.firstNameError = 'First name is required.';
    } else if (!this.nameValidPattern(this.firstName)) {
      this.firstNameError = 'First name must contain letters only.';
    } else {
      this.firstNameError = '';
    }
  }

  onLastNameChange(value: string) {
    this.markDirty();
    this.lastName = value;
    if (!this.lastName.trim()) {
      this.lastNameError = 'Last name is required.';
    } else if (!this.nameValidPattern(this.lastName)) {
      this.lastNameError = 'Last name must contain letters only.';
    } else {
      this.lastNameError = '';
    }
  }

  private emailDomainValid(value: string): boolean {
    const v = value.trim().toLowerCase();
    return v.endsWith('@ufs4life.ac.za') || v.endsWith('@gmail.com');
  }

  onEmailChange(value: string) {
    this.markDirty();
    this.email = value;
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
    this.markDirty();
    this.password = value || '';

    this.pwMinLen = this.password.length >= 8;
    this.pwUpper = /[A-Z]/.test(this.password);
    this.pwLower = /[a-z]/.test(this.password);
    this.pwDigit = /\d/.test(this.password);
    this.pwSymbol = /[^A-Za-z0-9]/.test(this.password);

    if (!this.password) {
      this.passwordError = 'Password is required.';
    } else if (!(this.pwMinLen && this.pwUpper && this.pwLower && this.pwDigit && this.pwSymbol)) {
      this.passwordError = 'Password does not meet all requirements.';
    } else {
      this.passwordError = '';
    }
  }

  get formValid(): boolean {
    const usernameOk = this.usernameStatus === 'unique';
    const nameOk = !this.firstNameError && !!this.firstName.trim();
    const surnameOk = !this.lastNameError && !!this.lastName.trim();
    const emailOk = !this.emailError && !!this.email.trim();
    const pwOk = !this.passwordError && !!this.password && this.pwMinLen && this.pwUpper && this.pwLower && this.pwDigit && this.pwSymbol;
    return usernameOk && nameOk && surnameOk && emailOk && pwOk;
  }

  /**
   * Sync logic: If a module is a Year module, checking/unchecking it in one list
   * mirrors the selection in the other list so both are always in step.
   */
  toggleModule(mod: Module, semester: 1 | 2, event: any) {
    const checked = !!event.target.checked;
    const id = mod.id;
    const isYear = !!mod.isYearModule || this.yearModuleIds.has(id);

    const primary = (semester === 1) ? this.selectedSemester1 : this.selectedSemester2;
    const other = (semester === 1) ? this.selectedSemester2 : this.selectedSemester1;

    const addIfMissing = (arr: number[], val: number) => { if (!arr.includes(val)) arr.push(val); };
    const removeIfPresent = (arr: number[], val: number) => {
      const i = arr.indexOf(val);
      if (i > -1) arr.splice(i, 1);
    };

    if (checked) {
      addIfMissing(primary, id);
      if (isYear) addIfMissing(other, id);  // auto-tick in the other list
    } else {
      removeIfPresent(primary, id);
      if (isYear) removeIfPresent(other, id); // keep both in sync on uncheck too
    }

    this.formDirty = true;
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
    if (this.formDirty) {
      const discard = await this.openConfirm();
      if (!discard) return;
    }
    this.originalHide();
  }

  submit() {
    // Guard: prevent submission on duplicate or invalid
    if (!this.formValid) {
      if (this.usernameStatus === 'duplicate') {
        this.toastr.error('A user with this Username already exists.');
      } else {
        this.toastr.error('Please fix the highlighted fields before submitting.');
      }
      return;
    }

    const payload = {
      userName: this.userName.trim(),
      firstName: this.firstName.trim(),
      lastName: this.lastName.trim(),
      email: this.email.trim().toLowerCase(),
      password: this.password,
      role: this.role,
      semester1ModuleIds: this.selectedSemester1,
      semester2ModuleIds: this.selectedSemester2
    };

    this.adminService.registerUser(payload).subscribe({
      next: (res: any) => {
        this.toastr.success(res?.message || 'User registered successfully.');
        this.formDirty = false;
        this.originalHide();
      },
      error: (err: any) => {
        const status = err?.status;
        const apiMsg = err?.error?.message;

        if (status === 409) {
          // Duplicate (server-side)
          this.toastr.error('A user with this Username already exists.');
        } else if (status === 400) {
          this.toastr.error(apiMsg || 'Invalid field data. Please review the inputs.');
        } else if (status >= 500) {
          this.toastr.error('Server error. Please try again.');
        } else {
          this.toastr.error(apiMsg || 'Could not register user. Please try again.');
        }
      }
    });
  }

  cancel() { this.attemptClose(); }
}
