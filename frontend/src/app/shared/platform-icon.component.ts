import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PLATFORM_META, Platform } from '../core/models';

/** Simple glyphs per source (generic symbols, not brand logos), filled with the platform colour. */
const GLYPHS: Record<Platform, string> = {
  // phone with chat lines
  sms: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm1 4v2h8V6H8Zm0 4v2h6v-2H8Zm3 8a1 1 0 1 0 2 0 1 1 0 0 0-2 0Z',
  // round speech bubble with typing dots
  whatsapp:
    'M12 2a10 10 0 0 0-8.66 15L2 22l5.12-1.32A10 10 0 1 0 12 2Zm0 2a8 8 0 1 1-4.18 14.82l-.36-.22-2.6.67.7-2.5-.24-.38A8 8 0 0 1 12 4ZM7.5 11a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Zm4.5 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Zm4.5 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z',
  // paper plane
  telegram: 'M21.6 3.2 2.9 10.4c-1 .4-1 1.8.1 2.1l4.6 1.4 1.8 5.6c.3.9 1.4 1.1 2 .4l2.5-2.6 4.6 3.4c.8.6 1.9.1 2.1-.8l3-15.1c.2-1.1-.9-2-2-1.6ZM9.6 14.2l8.5-7.6-6.8 9.1-.3 2.9-1.4-4.4Z',
  // envelope
  gmail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 3.2V18h16V7.2l-8 5.3-8-5.3ZM5.6 6l6.4 4.3L18.4 6H5.6Z',
};

@Component({
  selector: 'app-platform-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  template: `
    <svg viewBox="0 0 24 24" fill="currentColor" [attr.class]="classes()" role="img" [attr.aria-label]="label()">
      <path fill-rule="evenodd" [attr.d]="glyph()" />
    </svg>
  `,
})
export class PlatformIconComponent {
  readonly platform = input.required<Platform>();
  readonly size = input('size-4');
  /** Use the platform colour (default) or inherit the current text colour. */
  readonly colored = input(true);

  protected readonly glyph = computed(() => GLYPHS[this.platform()]);
  protected readonly label = computed(() => PLATFORM_META[this.platform()].label);
  protected readonly classes = computed(
    () => `${this.size()} ${this.colored() ? PLATFORM_META[this.platform()].text : ''}`,
  );
}
