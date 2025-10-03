import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { ToastrService } from 'ngx-toastr';

import { DocumentService } from '../_services/document.service';
import { UploadDocumentModalComponent } from '../modals/upload-document-modal/upload-document-modal.component';
import { Document } from '../_models/document';
import { RepositoryService } from '../_services/repository.service';
import { AccountService } from '../_services/account.service';
import { Repository } from '../_models/repository';
import { AddRepositoryModalComponent } from '../modals/add-repository-modal/add-repository-modal.component';
import { Pagination } from '../_models/pagination';
import { ConfirmDeleteModalComponent } from '../modals/confirm-delete-modal/confirm-delete-modal.component';

@Component({
  selector: 'app-repository',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './repository.component.html',
  styleUrls: ['./repository.component.css']
})
export class RepositoryComponent implements OnInit {
  externalRepos: Repository[] = [];
  internalDocuments: Document[] = [];

  externalPagination: Pagination | null = null;
  internalPagination: Pagination | null = null;
  externalPageNumber = 1;
  internalPageNumber = 1;
  pageSize = 6;

  bsModalRef?: BsModalRef;
  roles: string[] = [];

  constructor(
    private router: Router,
    private documentService: DocumentService,
    private repositoryService: RepositoryService,
    private modalService: BsModalService,
    private accountService: AccountService,
    private toastr: ToastrService
  ) { }

  ngOnInit(): void {
    this.roles = this.accountService.roles();
    this.loadInternalDocuments();
    this.loadExternalRepositories();
  }

  loadInternalDocuments() {
    this.documentService.getInternalRepositoryDocuments(this.internalPageNumber, this.pageSize).subscribe({
      next: response => {
        this.internalDocuments = response.body ?? [];
        const paginationHeader = response.headers.get('Pagination');
        if (paginationHeader) {
          this.internalPagination = JSON.parse(paginationHeader);
        }
      },
      error: err => {
        console.error('Failed to load internal documents', err);
        this.toastr.error('Failed to load internal documents.');
      }
    });
  }

  loadExternalRepositories() {
    this.repositoryService.getExternalRepositories(this.externalPageNumber, this.pageSize).subscribe({
      next: response => {
        this.externalRepos = response.body ?? [];
        const paginationHeader = response.headers.get('Pagination');
        if (paginationHeader) {
          this.externalPagination = JSON.parse(paginationHeader);
        }
      },
      error: err => {
        console.error('Failed to load external repositories', err);
        this.toastr.error('Failed to load external repositories.');
      }
    });
  }

  pageChangedExternal(page: number) {
    this.externalPageNumber = page;
    this.loadExternalRepositories();
  }

  pageChangedInternal(page: number) {
    this.internalPageNumber = page;
    this.loadInternalDocuments();
  }

  openUploadModal() {
    const initialState: Partial<UploadDocumentModalComponent> = {
      formData: {
        source: 'Repository' as 'Repository',
        moduleId: null
      }
    };

    this.bsModalRef = this.modalService.show(UploadDocumentModalComponent, { initialState });
    this.bsModalRef.content.onUpload.subscribe(() => this.loadInternalDocuments());
  }

  openAddRepositoryModal() {
    this.bsModalRef = this.modalService.show(AddRepositoryModalComponent);
    this.bsModalRef.content.onAdd.subscribe(() => this.loadExternalRepositories());
  }

  deleteDocument(docId: number) {
    this.documentService.deleteRepositoryDocument(docId).subscribe({
      next: () => {
        this.internalDocuments = this.internalDocuments.filter(d => d.id !== docId);
        this.loadInternalDocuments();
      },
      error: err => {
        console.error('Failed to delete document', err);
        if (err.status === 403 || err.status === 500) {
          this.toastr.error('You are not authorized to delete this document.');
        } else {
          this.toastr.error('Failed to delete the document. Please try again later.');
        }
      }
    });
  }

  deleteExternalRepository(id: number) {
    if (!this.hasRepoManagementRights()) return;

    const initialState: Partial<ConfirmDeleteModalComponent> = {
      title: 'Confirm Repository Deletion',
      message: 'Are you sure you want to delete this external repository?',
      onConfirm: () => {
        this.repositoryService.deleteExternalRepository(id).subscribe({
          next: () => {
            this.toastr.success('Repository removed successfully.');
            if (this.externalRepos.length === 1 && this.externalPageNumber > 1) {
              this.externalPageNumber--;
            }
            this.loadExternalRepositories();
          },
          error: err => {
            console.error('Failed to delete repository', err);
            this.toastr.error('Failed to delete repository.');
          }
        });
      }
    };

    this.bsModalRef = this.modalService.show(ConfirmDeleteModalComponent, { initialState });
  }

  hasUploadRights(): boolean {
    return this.roles.includes('Lecturer') || this.roles.includes('Coordinator') || this.roles.includes('Admin');
  }

  hasRepoManagementRights(): boolean {
    return this.roles.includes('Coordinator') || this.roles.includes('Admin');
  }

  openInternalRepository() {
    this.router.navigate(['/repository']);
  }
}
