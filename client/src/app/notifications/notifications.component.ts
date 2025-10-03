import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Notification } from '../_models/notification';
import { NotificationService } from '../_services/notification.service';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { CreateNotificationModalComponent } from '../modals/create-notification-modal/create-notification-modal.component';
import { AccountService } from '../_services/account.service';
import { Pagination } from '../_models/pagination';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ConfirmDeleteModalComponent } from '../modals/confirm-delete-modal/confirm-delete-modal.component';
import { BsDropdownModule } from 'ngx-bootstrap/dropdown';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule, BsDropdownModule],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent implements OnInit {
  notifications: Notification[] = [];
  filtered: Notification[] = [];
  pagination: Pagination | null = null;
  pageNumber = 1;
  pageSize = 10;
  bsModalRef?: BsModalRef;
  currentUserRole: string = '';
  currentUserName: string = '';

  typeFilter: string = '';
  readFilter: '' | 'read' | 'unread' = '';

  selectedImageUrl: string | null = null;
  showImageModal: boolean = false;

  // modal zoom state
  isZoomed = false;

  constructor(
    private notificationService: NotificationService,
    private modalService: BsModalService,
    private accountService: AccountService,
    private router: Router,
    private toastr: ToastrService
  ) { }

  ngOnInit(): void {
    const user = this.accountService.currentUser();
    this.currentUserName = user?.userName || '';
    this.currentUserRole = this.accountService.getUserRole();
    this.loadNotifications();
  }

  loadNotifications() {
    this.notificationService
      .getPaginatedNotifications(this.pageNumber, this.pageSize, this.typeFilter, this.readFilter)
      .subscribe({
        next: response => {
          const items = response.body ?? [];
          this.pagination = JSON.parse(response.headers.get('Pagination')!);

          this.notifications = [...items].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

          this.applyFilters();
        },
        error: err => console.error(err)
      });
  }

  applyFilters() {
    let list = [...this.notifications];

    if (this.readFilter === 'read') list = list.filter(x => !!x.isRead);
    else if (this.readFilter === 'unread') list = list.filter(x => !x.isRead);

    this.filtered = list;
  }

  onTypeFilterChanged() {
    this.pageNumber = 1;
    this.loadNotifications();
  }

  onReadFilterChanged() {
    this.pageNumber = 1;
    this.loadNotifications();
  }

  pageChanged(newPage: number) {
    this.pageNumber = newPage;
    this.loadNotifications();
  }

  openPostModal() {
    this.bsModalRef = this.modalService.show(CreateNotificationModalComponent, {
      class: 'modal-lg'
    });
    this.bsModalRef.onHidden?.subscribe(() => this.loadNotifications());
  }

  /** Render the blue badge/label at the top-left of the card.
   *  Special rule: FAQ auto items and FaqUpdate type show "FAQ UPDATE NOTIFICATION". */
  formatBadgeLabel(type: string, title?: string): string {
    const t = (type || '').toLowerCase();
    const titleLc = (title || '').toLowerCase();

    const looksLikeLegacyFaqAuto =
      t === 'general' &&
      (titleLc.startsWith('new faq announcement') || titleLc.startsWith('faq updated announcement'));

    if (t === 'faqupdate' || looksLikeLegacyFaqAuto) {
      return 'FAQ UPDATE NOTIFICATION';
    }

    const readable = (type || '').replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase();
    const isAnnouncement = t === 'general' || t === 'system';
    return isAnnouncement ? `${readable} ANNOUNCEMENT` : `${readable} NOTIFICATION`;
  }

  formatAudience(audience?: string | null): string {
    const key = (audience || '').toLowerCase();
    switch (key) {
      case 'all': return 'All users';
      case 'students': return 'Students';
      case 'staff': return 'Staff';
      case 'modulestudents': return 'Module students';
      case 'yearmodulestudents': return 'Year-module students';
      default: return audience || 'All users';
    }
  }

  markAsRead(a: Notification) {
    if (a.isRead) return;
    this.notificationService.markAsRead(a.id).subscribe({
      next: () => { a.isRead = true; this.applyFilters(); },
      error: err => console.error(err)
    });
  }

  // 🔁 persisted via backend
  markAsUnread(a: Notification) {
    if (!a.isRead) return;
    this.notificationService.markAsUnread(a.id).subscribe({
      next: () => { a.isRead = false; this.applyFilters(); },
      error: err => console.error(err)
    });
  }

  openImageModal(imageUrl: string) {
    this.selectedImageUrl = imageUrl;
    this.isZoomed = false; // start fit-to-screen
    this.showImageModal = true;
  }

  closeImageModal() {
    this.selectedImageUrl = null;
    this.isZoomed = false;
    this.showImageModal = false;
  }

  toggleZoom() {
    this.isZoomed = !this.isZoomed;
  }

  // ======= Auto-click logic + deep-links =======

  private lc(s?: string | null): string { return (s || '').toLowerCase(); }

  /** Recognize legacy FAQ auto announcements (General with specific titles) */
  private isLegacyFaqAuto(n: Notification): boolean {
    const t = this.lc(n.type);
    const title = this.lc(n.title);
    return t === 'general' && (title.startsWith('new faq announcement') || title.startsWith('faq updated announcement'));
  }

  /** Centralized rule for whether the current user may navigate from a card. */
  private canNavigate(n: Notification, role: string): boolean {
    if (role === 'Admin') {
      const t = this.lc(n.type);
      const isSchedule = t === 'scheduleupdate' || t === 'schedulerupdate';
      const isModuleRelated = t === 'documentupload' || t === 'moduleupdate' || n.moduleId != null;
      if (isSchedule || isModuleRelated) return false; // Admins: not clickable for module/schedule items
    }
    return true;
  }

  /** Role-aware card interactivity. */
  isAutoInteractive(n: Notification): boolean {
    if (!this.canNavigate(n, this.currentUserRole)) return false;

    const t = this.lc(n.type);

    // Always clickable:
    if (t === 'repositoryupdate' || t === 'faqupdate' || this.isLegacyFaqAuto(n)) return true;

    // ModuleUpdate: clickable for non-admin users → lands on Modules page
    if (t === 'moduleupdate' && this.currentUserRole !== 'Admin') return true;

    // Existing types
    if (t === 'documentupload' || t === 'scheduleupdate' || t === 'schedulerupdate') return true;

    return false;
  }

  /** Card click handler with guard so buttons, selects, and thumbnails don't trigger navigation. */
  handleCardClick(evt: MouseEvent, n: Notification) {
    if (!this.isAutoInteractive(n)) return;

    const target = evt.target as HTMLElement;
    if (target.closest('.thumb-wrap, .btn, button, a, select, option, .dropdown-menu')) {
      return; // let the inner control handle it
    }

    this.navigateFor(n);
  }

  /** Try to extract module context (e.g., CSIS6809) from title/message. */
  private extractModuleContext(n: Notification): { code?: string } {
    const title = (n.title || '').trim();
    const msg = (n.message || '').trim();
    const hay = `${title} ${msg}`;

    // 1) [CSIS6809] style
    const bracket = hay.match(/\[([A-Za-z]{2,}\d{3,})\]/);
    if (bracket?.[1]) return { code: bracket[1].toUpperCase() };

    // 2) Bare token like CSIS6809
    const bare = hay.match(/\b[A-Za-z]{2,}\d{3,}\b/);
    if (bare?.[0]) return { code: bare[0].toUpperCase() };

    // 3) "for CSIS6809" style
    const forCode = hay.match(/\bfor\s+([A-Za-z]{2,}\d{3,})\b/i);
    if (forCode?.[1]) return { code: forCode[1].toUpperCase() };

    return {};
  }

  /** Deep-link map to the correct destination based on type/title/moduleId. */
  private navigateFor(n: Notification) {
    const t = this.lc(n.type);
    const title = this.lc(n.title);
    const msg = this.lc(n.message);

    // Module document uploads → Courses → [Module] → Documents
    if (t === 'documentupload') {
      if (n.moduleId != null) {
        const ctx = this.extractModuleContext(n);
        this.router.navigate(['/modules', n.moduleId], {
          state: { fromNotification: true, moduleCode: ctx.code },
          queryParams: { from: 'notification', view: 'documents', code: ctx.code }
        });
      } else {
        // Fallback: repository documents
        this.router.navigate(['/repository'], { state: { view: 'documents' }, queryParams: { view: 'documents' } });
      }
      return;
    }

    // Repository updates → Repository
    if (t === 'repositoryupdate') {
      const looksLikeLinks = title.includes('link') || title.includes('external repository') || msg.includes('link');
      const view = looksLikeLinks ? 'links' : 'documents';
      this.router.navigate(['/repository'], { state: { view }, queryParams: { view } });
      return;
    }

    // Schedule updates → Scheduler
    if (t === 'scheduleupdate' || t === 'schedulerupdate') {
      let tab: 'lab' | 'assessment' | 'class' = 'class';
      if (title.includes('lab')) tab = 'lab';
      else if (title.includes('assessment') || msg.includes('assessment')) tab = 'assessment';
      else tab = 'class';

      this.router.navigate(['/scheduler'], { state: { tab }, queryParams: { tab } });
      return;
    }

    // FAQ updates (new type) and legacy auto FAQ → FAQ page
    if (t === 'faqupdate' || this.isLegacyFaqAuto(n)) {
      this.router.navigate(['/faq']);
      return;
    }

    // Module updates → Modules page (list)
    if (t === 'moduleupdate') {
      this.router.navigate(['/modules']);
      return;
    }
  }

  // ======= Owner-only delete for manually posted announcements =======

  /** A "manually posted announcement" = General/System that is NOT an auto item (e.g., not FAQ auto). */
  private isManualAnnouncement(n: Notification): boolean {
    const t = this.lc(n.type);
    return (t === 'general' || t === 'system') && !this.isLegacyFaqAuto(n);
  }

  /** UI should show Delete only if it's a manual announcement AND the current user is the creator. */
  canShowDelete(n: Notification): boolean {
    if (!this.isManualAnnouncement(n)) return false;
    return (n.createdBy || '').toLowerCase() === this.currentUserName.toLowerCase();
  }

  openDeleteAnnouncement(n: Notification) {
    const initialState = {
      title: 'Delete announcement?',
      message: 'Are you sure you want to delete this announcement?',
      onConfirm: () => {
        this.notificationService.delete(n.id).subscribe({
          next: () => {
            this.notifications = this.notifications.filter(x => x.id !== n.id);
            this.filtered = this.filtered.filter(x => x.id !== n.id);
            this.toastr.success('Announcement deleted.');
          },
          error: (err) => {
            if (err?.status === 403 || err?.status === 401) {
              this.toastr.error('You can only delete announcements you posted.');
            } else {
              this.toastr.error('Failed to delete announcement.');
            }
          }
        });
      }
    };
    this.modalService.show(ConfirmDeleteModalComponent, { initialState, class: 'modal-dialog-centered' });
  }
}
