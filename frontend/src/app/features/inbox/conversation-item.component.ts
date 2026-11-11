import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Conversation } from '../../core/models';
import { AvatarComponent } from '../../shared/avatar.component';
import { ListTimePipe } from '../../shared/time.pipes';

@Component({
  selector: 'app-conversation-item',
  imports: [RouterLink, AvatarComponent, ListTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      [routerLink]="['/inbox', c().key]"
      class="flex items-center gap-3 px-4 py-3 transition"
      [class]="
        active()
          ? 'bg-sky-50 dark:bg-sky-500/10'
          : 'hover:bg-slate-50 dark:hover:bg-slate-900'
      "
      [attr.aria-current]="active() ? 'page' : null"
    >
      <app-avatar [name]="c().title" [platform]="c().platform" />
      <div class="min-w-0 flex-1">
        <div class="flex items-baseline gap-2">
          <span class="truncate text-sm" [class]="unread() ? 'font-semibold' : 'font-medium'">
            {{ c().title || c().externalId }}
          </span>
          <span
            class="ml-auto shrink-0 text-xs tabular-nums"
            [class]="unread() ? 'font-semibold text-sky-600 dark:text-sky-400' : 'text-slate-400'"
          >
            {{ c().lastMessageAt | listTime }}
          </span>
        </div>
        <div class="mt-0.5 flex items-center gap-2">
          <p
            class="line-clamp-1 flex-1 text-sm break-all"
            [class]="unread() ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'"
          >
            @if (prefix()) {
              <span class="text-slate-400 dark:text-slate-500">{{ prefix() }}: </span>
            }
            {{ preview() }}
          </p>
          @if (unread()) {
            <span
              class="flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-600 px-1.5 text-[11px] font-semibold text-white tabular-nums"
              [attr.aria-label]="c().unreadCount + ' unread'"
            >
              {{ c().unreadCount > 99 ? '99+' : c().unreadCount }}
            </span>
          }
        </div>
      </div>
    </a>
  `,
})
export class ConversationItemComponent {
  readonly c = input.required<Conversation>({ alias: 'conversation' });
  readonly active = input(false);

  protected readonly unread = computed(() => this.c().unreadCount > 0);

  /** Email previews start with "Subject - "; the subject is already the title, so drop it. */
  protected readonly preview = computed(() => {
    const text = this.c().lastMessage?.text || 'No messages';
    const prefix = `${this.c().title} - `;
    return this.c().platform === 'gmail' && text.startsWith(prefix) ? text.slice(prefix.length) : text;
  });

  /** "You" for own messages, sender's first name in groups. */
  protected readonly prefix = computed(() => {
    const last = this.c().lastMessage;
    if (!last) return '';
    if (last.direction === 'out') return 'You';
    if (this.c().type === 'group' && last.fromName) return last.fromName.split(' ')[0];
    return '';
  });
}
