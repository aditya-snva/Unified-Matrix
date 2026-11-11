import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PLATFORM_META, Platform } from '../core/models';
import { PlatformIconComponent } from './platform-icon.component';

/** Initials avatar tinted by platform, with a small platform badge in the corner. */
@Component({
  selector: 'app-avatar',
  imports: [PlatformIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative inline-flex shrink-0' },
  template: `
    <span
      class="flex items-center justify-center rounded-full font-semibold select-none"
      [class]="sizeClass() + ' ' + tint()"
    >
      {{ initials() }}
    </span>
    @if (badge()) {
      <span
        class="absolute -right-0.5 -bottom-0.5 flex size-4.5 items-center justify-center rounded-full bg-white ring-2 ring-white dark:bg-slate-900 dark:ring-slate-900"
      >
        <app-platform-icon [platform]="platform()" size="size-3" />
      </span>
    }
  `,
})
export class AvatarComponent {
  readonly name = input<string | undefined>('');
  readonly platform = input.required<Platform>();
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly badge = input(true);

  protected readonly tint = computed(() => PLATFORM_META[this.platform()].soft);
  protected readonly sizeClass = computed(
    () => ({ sm: 'size-8 text-xs', md: 'size-11 text-sm', lg: 'size-12 text-base' })[this.size()],
  );

  protected readonly initials = computed(() => {
    const name = (this.name() || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
    if (!name) return '#';
    if (/^\+?\d[\d\s]*$/.test(name)) return '#'; // phone numbers
    const parts = name.split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '')).toUpperCase();
  });
}
