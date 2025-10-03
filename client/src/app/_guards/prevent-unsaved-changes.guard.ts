import { CanDeactivateFn } from '@angular/router';

export interface FormComponent {
    editForm?: { dirty: boolean };
}

export const preventUnsavedChangesGuard: CanDeactivateFn<FormComponent> = (component) => {
    if (component.editForm?.dirty) {
        return confirm('Are you sure you want to continue? Any unsaved changes will be lost');
    }
    return true;
};
