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

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
    private router: Router
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

  formatBadgeLabel(type: string): string {
    const t = (type || '').toLowerCase();
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

  // ======= NEW: Auto-click logic + deep-links =======

  private lc(s?: string | null): string { return (s || '').toLowerCase(); }

  /** Only auto-triggered items are interactive; manual System/General remain non-clickable.
   *  Auto = DocumentUpload, RepositoryUpdate, ScheduleUpdate/SchedulerUpdate,
   *  and FAQ auto-announcements (General with specific titles). */
  isAutoInteractive(n: Notification): boolean {
    const t = this.lc(n.type);
    if (t === 'documentupload' || t === 'repositoryupdate' || t === 'scheduleupdate' || t === 'schedulerupdate') {
      return true;
    }
    if (t === 'general') {
      const title = this.lc(n.title);
      // These General items are auto posted by the system (FAQ create/update)
      return title.startsWith('new faq announcement') || title.startsWith('faq updated announcement');
    }
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

  /** Deep-link map to the correct destination based on type/title/moduleId. */
  private navigateFor(n: Notification) {
    const t = this.lc(n.type);
    const title = this.lc(n.title);
    const msg = this.lc(n.message);

    // Module document uploads → Courses → [Module] → Documents
    if (t === 'documentupload') {
      if (n.moduleId != null) {
        this.router.navigate(['/modules', n.moduleId], {
          // keep both state and query in case the target component uses either
          state: { fromNotification: true },
          queryParams: { from: 'notification', view: 'documents' }
        });
      } else {
        // Fallback: if no moduleId, send to repository documents
        this.router.navigate(['/repository'], { state: { view: 'documents' }, queryParams: { view: 'documents' } });
      }
      return;
    }

    // Repository updates → Repository (Documents by default)
    if (t === 'repositoryupdate') {
      const looksLikeLinks = title.includes('link') || title.includes('external repository') || msg.includes('link');
      const view = looksLikeLinks ? 'links' : 'documents';
      this.router.navigate(['/repository'], { state: { view }, queryParams: { view } });
      return;
    }

    // Schedule updates → Scheduler with correct tab preselected
    if (t === 'scheduleupdate' || t === 'schedulerupdate') {
      // Heuristics:
      // - Title mentioning "lab" or ModuleId == null (our lab updates) => lab tab
      // - Title mentioning "assessment" or "assessments" => assessment tab
      // - else => class tab
      let tab: 'lab' | 'assessment' | 'class' = 'class';
      if (title.includes('lab')) tab = 'lab';
      else if (title.includes('assessment') || msg.includes('assessment')) tab = 'assessment';
      else tab = 'class';

      this.router.navigate(['/scheduler'], { state: { tab }, queryParams: { tab } });
      return;
    }

    // FAQ auto-announcements (General) → FAQ page
    if (t === 'general') {
      const isFaqAuto = title.startsWith('new faq announcement') || title.startsWith('faq updated announcement');
      if (isFaqAuto) {
        this.router.navigate(['/faq']);
      }
      return;
    }
  }
}
