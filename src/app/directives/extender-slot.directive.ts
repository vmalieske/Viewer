import {
  Directive,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewContainerRef,
  inject,
  input,
  output,
} from '@angular/core';
import { ExtenderSlotEvent, ExtenderSlotManager } from '@kompakkt/plugins/extender';
import { Observable } from 'rxjs';

@Directive({
  selector: '[extendSlot]',
  standalone: true,
})
export class ExtenderSlotDirective implements OnInit, OnDestroy {
  #viewContainerRef = inject(ViewContainerRef);
  #elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  extendSlot = input<string | undefined>();
  dataObservable = input<Observable<unknown>>();
  slotBehaviour = input<'append' | 'prepend' | 'replace'>();
  event = output<ExtenderSlotEvent>();

  ngOnInit() {
    const slotName = this.extendSlot();
    const slotBehaviour = this.slotBehaviour() ?? 'append';
    const dataObservable = this.dataObservable();

    if (!slotName) {
      throw new Error('extendSlot directive requires a slot name');
    }

    const slotEvents = ExtenderSlotManager.registerSlot({
      slotName,
      slotBehaviour,
      elementRef: this.#elementRef,
      viewContainerRef: this.#viewContainerRef,
      dataObservable,
    });

    slotEvents.subscribe(event => this.event.emit(event));
  }

  ngOnDestroy() {
    const slotName = this.extendSlot();
    if (!slotName) return;
    ExtenderSlotManager.unregisterSlot(slotName);
  }
}
