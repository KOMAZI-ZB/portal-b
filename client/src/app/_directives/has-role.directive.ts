import { Directive, Input, TemplateRef, ViewContainerRef, effect, inject } from '@angular/core';
import { AccountService } from '../_services/account.service';

@Directive({
  selector: '[appHasRole]',
  standalone: true
})
export class HasRoleDirective {
  @Input() appHasRole: string[] = [];
  private accountService = inject(AccountService);
  private viewContainerRef = inject(ViewContainerRef);
  private templateRef = inject(TemplateRef<any>);

  constructor() {
    effect(() => {
      const roles = this.accountService.roles();
      const hasMatch = Array.isArray(roles)
        ? roles.some(role => this.appHasRole.includes(role))
        : this.appHasRole.includes(roles);

      this.viewContainerRef.clear();
      if (hasMatch) {
        this.viewContainerRef.createEmbeddedView(this.templateRef);
      }
    });
  }
}
