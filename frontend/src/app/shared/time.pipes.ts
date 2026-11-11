import { Pipe, PipeTransform } from '@angular/core';
import { formatAgo, formatBytes, formatClock, formatFull, formatListTime } from '../core/time';

@Pipe({ name: 'listTime' })
export class ListTimePipe implements PipeTransform {
  transform(value: string | Date | undefined | null): string {
    return formatListTime(value);
  }
}

@Pipe({ name: 'clock' })
export class ClockPipe implements PipeTransform {
  transform(value: string | Date): string {
    return formatClock(value);
  }
}

@Pipe({ name: 'fullDate' })
export class FullDatePipe implements PipeTransform {
  transform(value: string | Date): string {
    return formatFull(value);
  }
}

/** Impure on purpose: re-evaluates on change detection so "2m ago" stays fresh. */
@Pipe({ name: 'ago', pure: false })
export class AgoPipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    return formatAgo(value);
  }
}

@Pipe({ name: 'bytes' })
export class BytesPipe implements PipeTransform {
  transform(value?: number): string {
    return formatBytes(value);
  }
}
