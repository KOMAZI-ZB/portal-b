import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentService } from '../_services/document.service';
import { Document } from '../_models/document';
import { UploadDocumentModalComponent } from '../modals/upload-document-modal/upload-document-modal.component';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { AccountService } from '../_services/account.service';
import { Pagination } from '../_models/pagination';
import { ActivatedRoute, Router } from '@angular/router';
import { ModuleService } from '../_services/module.service';
import { Module } from '../_models/module';
import { ConfirmDeleteModalComponent } from '../modals/confirm-delete-modal/confirm-delete-modal.component';

@Component({
  selector: 'app-module-documents',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './module-documents.component.html',
  styleUrls: ['./module-documents.component.css']
})
export class ModuleDocumentsComponent implements OnInit {
  moduleId!: number;
  moduleCode: string = '';
  moduleName: string = '';
  documents: Document[] = [];
  bsModalRef?: BsModalRef;
  roles: string[] = [];
  private currentUserName: string = '';

  pagination: Pagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0,
    totalPages: 0
  };

  constructor(
    private route: ActivatedRoute,
    private documentService: DocumentService,
    private modalService: BsModalService,
    private accountService: AccountService,
    private router: Router,
    private moduleService: ModuleService
  ) { }

  ngOnInit(): void {
    this.roles = this.accountService.roles();
    this.currentUserName = this.accountService.currentUser()?.userName ?? '';
    this.moduleId = +this.route.snapshot.paramMap.get('id')!;

    // 1) Router state
    const s = (history && history.state) ? (history.state as any) : {};
    if (s?.moduleCode) this.moduleCode = s.moduleCode;
    if (s?.moduleName) this.moduleName = s.moduleName;

    // 2) Query params
    const qp = this.route.snapshot.queryParamMap;
    this.moduleCode = qp.get('code') ?? this.moduleCode;
    this.moduleName = qp.get('name') ?? this.moduleName;

    this.route.queryParamMap.subscribe(p => {
      const code = p.get('code');
      const name = p.get('name');
      if (code) this.moduleCode = code;
      if (name) this.moduleName = name;
    });

    // 3) Staff fetch confirmed details
    if (this.hasUploadRights()) {
      this.loadHeaderContext();
    }

    this.loadDocuments();
  }

  private loadHeaderContext() {
    this.moduleService.getModuleById(this.moduleId).subscribe({
      next: (m: Module) => {
        this.moduleCode = m?.moduleCode ?? this.moduleCode;
        this.moduleName = m?.moduleName ?? this.moduleName;
      },
      error: () => { /* ignore */ }
    });
  }

  loadDocuments() {
    this.documentService
      .getDocumentsByModulePaged(this.moduleId, this.pagination.currentPage, this.pagination.itemsPerPage)
      .subscribe({
        next: (response) => {
          const body = response.body || [];
          this.documents = [...body].sort((a, b) =>
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
          );

          const paginationHeader = response.headers.get('Pagination');
          if (paginationHeader) {
            this.pagination = JSON.parse(paginationHeader);
          }
        },
        error: (err) => console.error('Failed to load documents', err)
      });
  }

  pageChanged(event: any): void {
    this.pagination.currentPage = event.page;
    this.loadDocuments();
  }

  openUploadModal() {
    this.bsModalRef = this.modalService.show(UploadDocumentModalComponent);

    setTimeout(() => {
      if (this.bsModalRef?.content) {
        this.bsModalRef.content.formData = {
          source: 'Module',
          moduleId: this.moduleId
        };

        this.bsModalRef.content.onUpload.subscribe(() => {
          this.loadDocuments();
        });
      }
    }, 0);
  }

  // Uploader-only check for Delete visibility
  canDelete(doc: Document): boolean {
    return !!doc.uploadedByUserName && doc.uploadedByUserName === this.currentUserName;
  }

  // Show confirm modal before deleting
  confirmDelete(docId: number) {
    const initialState: Partial<ConfirmDeleteModalComponent> = {
      title: 'Confirm Deletion',
      message: 'Are you sure you want to delete this document?',
      confirmText: 'Delete',
      cancelText: 'No',
      onConfirm: () => this.performDelete(docId)
    };
    this.modalService.show(ConfirmDeleteModalComponent, { initialState, class: 'modal-dialog-centered' });
  }

  private performDelete(docId: number) {
    this.documentService.deleteModuleDocument(docId).subscribe({
      next: () => {
        this.documents = this.documents.filter((d) => d.id !== docId);
        // keep pagination state; no other changes
      },
      error: (err) => console.error('Failed to delete document', err)
    });
  }

  hasUploadRights(): boolean {
    return (
      this.roles.includes('Lecturer') ||
      this.roles.includes('Coordinator') ||
      this.roles.includes('Admin')
    );
  }

  goBack(): void {
    this.router.navigate(['/modules']);
  }
}
