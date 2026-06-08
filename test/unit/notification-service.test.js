/**
 * NotificationService Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const NotificationService =
  (await import('../../src/renderer/modules/core/NotificationService.js')).default ||
  (await import('../../src/renderer/modules/core/NotificationService.js'));

describe('NotificationService', () => {
  let ns;

  beforeEach(() => {
    // Mock DOM
    document.body.innerHTML = '';
    ns = new NotificationService({ duration: 0 }); // 0 = no auto-dismiss
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('initialization', () => {
    it('should create a notification container in DOM', () => {
      const container = document.getElementById('notification-container');
      expect(container).not.toBeNull();
      expect(container.className).toContain('notification-container');
    });

    it('should inject styles into head', () => {
      const styles = document.getElementById('notification-styles');
      expect(styles).not.toBeNull();
      expect(styles.tagName).toBe('STYLE');
    });

    it('should reuse existing container if present', () => {
      const first = document.getElementById('notification-container');
      new NotificationService();
      const second = document.getElementById('notification-container');
      expect(second).toBe(first);
    });
  });

  describe('toast()', () => {
    it('should create a toast element', () => {
      ns.toast('Hello world', 'info');
      const toasts = document.querySelectorAll('.notification-toast');
      expect(toasts.length).toBe(1);
      expect(toasts[0].textContent).toContain('Hello world');
    });

    it('should set correct type class', () => {
      ns.toast('Success!', 'success');
      const toast = document.querySelector('.notification-toast');
      expect(toast.classList.contains('notification-success')).toBe(true);
    });

    it('should set error type class', () => {
      ns.toast('Error!', 'error');
      const toast = document.querySelector('.notification-toast');
      expect(toast.classList.contains('notification-error')).toBe(true);
    });

    it('should set warn type class', () => {
      ns.toast('Warning!', 'warn');
      const toast = document.querySelector('.notification-toast');
      expect(toast.classList.contains('notification-warn')).toBe(true);
    });

    it('should deduplicate same message within 1 second', () => {
      ns.toast('Duplicate', 'info');
      ns.toast('Duplicate', 'info');
      const toasts = document.querySelectorAll('.notification-toast');
      expect(toasts.length).toBe(1);
    });

    it('should not deduplicate different messages', () => {
      ns.toast('First', 'info');
      ns.toast('Second', 'info');
      const toasts = document.querySelectorAll('.notification-toast');
      expect(toasts.length).toBe(2);
    });

    it('should limit max toasts (default 5)', () => {
      for (let i = 0; i < 7; i++) {
        ns.toast(`Toast ${i}`, 'info');
      }
      const toasts = document.querySelectorAll('.notification-toast');
      expect(toasts.length).toBeLessThanOrEqual(5);
    });

    it('should include close button', () => {
      ns.toast('Close me', 'info');
      const btn = document.querySelector('.notification-close');
      expect(btn).not.toBeNull();
      expect(btn.textContent).toContain('×');
    });

    it('should remove toast on close button click', () => {
      ns.toast('Close me', 'info');
      const btn = document.querySelector('.notification-close');
      btn.click();
      // Toast removal is async (animation)
    });
  });

  describe('dismissAll()', () => {
    it('should remove all active toasts', () => {
      ns.toast('One', 'info');
      ns.toast('Two', 'info');
      expect(document.querySelectorAll('.notification-toast').length).toBe(2);
      ns.dismissAll();
    });
  });

  describe('confirm()', () => {
    it('should create a confirm dialog', async () => {
      const promise = ns.confirm('Are you sure?', 'Delete');
      const dialog = document.querySelector('.notification-dialog');
      expect(dialog).not.toBeNull();
      expect(dialog.textContent).toContain('Are you sure?');
      expect(dialog.textContent).toContain('Delete');

      // Clean up
      const cancelBtn = document.querySelector('.notification-btn-cancel');
      cancelBtn.click();
      const result = await promise;
      expect(result).toBe(false);
    });

    it('should resolve true on confirm', async () => {
      const promise = ns.confirm('Proceed?', 'Confirm');
      const confirmBtn = document.querySelector('.notification-btn-confirm');
      confirmBtn.click();
      const result = await promise;
      expect(result).toBe(true);
    });

    it('should resolve false on cancel', async () => {
      const promise = ns.confirm('Proceed?', 'Confirm');
      const cancelBtn = document.querySelector('.notification-btn-cancel');
      cancelBtn.click();
      const result = await promise;
      expect(result).toBe(false);
    });
  });

  describe('prompt()', () => {
    it('should create a prompt dialog with default value', async () => {
      const promise = ns.prompt('Enter name', 'John');
      const input = document.querySelector('.notification-input');
      expect(input).not.toBeNull();
      expect(input.value).toBe('John');

      const cancelBtn = document.querySelector('.notification-btn-cancel');
      cancelBtn.click();
      const result = await promise;
      expect(result).toBeNull();
    });

    it('should resolve with input value on confirm', async () => {
      const promise = ns.prompt('Enter name', 'default');
      const input = document.querySelector('.notification-input');
      input.value = 'Alice';
      const confirmBtn = document.querySelector('.notification-btn-confirm');
      confirmBtn.click();
      const result = await promise;
      expect(result).toBe('Alice');
    });

    it('should resolve with input value on Enter key', async () => {
      const promise = ns.prompt('Enter name', '');
      const input = document.querySelector('.notification-input');
      input.value = 'Bob';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      const result = await promise;
      expect(result).toBe('Bob');
    });
  });

  describe('HTML escaping', () => {
    it('should escape HTML in toast messages', () => {
      ns.toast('<script>alert("xss")</script>', 'info');
      const toast = document.querySelector('.notification-message');
      expect(toast.innerHTML).not.toContain('<script>');
      expect(toast.innerHTML).toContain('&lt;script&gt;');
    });
  });
});
