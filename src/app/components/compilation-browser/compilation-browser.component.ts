import { AsyncPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { filter, map } from 'rxjs';
import { FixImageUrlPipe } from 'src/app/pipes/fix-image-url.pipe';
import { ICompilation, IEntity, isCompilation, isEntity } from '@kompakkt/common';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ProcessingService } from '../../services/processing/processing.service';
import { ButtonComponent, ButtonRowComponent, TooltipDirective } from '@kompakkt/komponents';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { BackendService } from 'src/app/services/backend/backend.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-compilation-browser',
  templateUrl: './compilation-browser.component.html',
  styleUrls: ['./compilation-browser.component.scss'],
  imports: [
    AsyncPipe,
    TranslatePipe,
    FixImageUrlPipe,
    ButtonComponent,
    ButtonRowComponent,
    MatIconModule,
    TooltipDirective,
  ],
})
export class CompilationBrowserComponent {
  processing = inject(ProcessingService);
  backend = inject(BackendService);

  isReorderEnabled = signal(false);
  #originalOrder = signal<IEntity[]>([]);

  public colorToRGBA = (colorString: { r: number; g: number; b: number; a: number }) => {
    return `rgba(${colorString.r}, ${colorString.g}, ${colorString.b}, ${colorString.a})`;
  };

  compilation$ = this.processing.compilation$;
  entity$ = this.processing.entity$;
  #isCompilationOwner$ = this.processing.isOwner$.pipe(map(({ ofCompilation }) => ofCompilation));
  isCompilationOwner = toSignal(this.#isCompilationOwner$);

  entities$ = this.compilation$.pipe(
    filter(isCompilation),
    map(({ entities }) => Object.values(entities)),
    map(entities => entities.filter(isEntity)),
  );

  async enableReorder() {
    const isEnabled = this.isReorderEnabled();
    if (isEnabled) return;
    // Save current order for cancellation
    const entitiesArr = await firstValueFrom(this.entities$);
    this.#originalOrder.set(entitiesArr);
    this.isReorderEnabled.set(true);
  }

  async cancelReorder() {
    const compilation = await firstValueFrom(this.compilation$);
    if (compilation) {
      this.processing.compilation$.next(
        this.#combineArrayWithCompilation(this.#originalOrder(), compilation),
      );
    }

    this.#originalOrder.set([]);
    this.isReorderEnabled.set(false);
  }

  #combineArrayWithCompilation(entities: IEntity[], compilation: ICompilation): ICompilation {
    return {
      ...compilation,
      entities: entities.reduce((acc, entity) => ({ ...acc, [entity._id]: entity }), {}),
    };
  }

  async saveReorder() {
    const compilation = await firstValueFrom(this.compilation$);
    if (!compilation) return;
    const updatedCompilation = await this.backend.updateCompilation(compilation);
    if (updatedCompilation) {
      this.processing.compilation$.next({ ...compilation });
      this.#originalOrder.set([]);
      this.isReorderEnabled.set(false);
    }
  }

  async applyReorderAction(
    event: Event,
    action: 'move_top' | 'move_up' | 'move_down' | 'move_bottom',
    index: number,
  ) {
    event.stopPropagation();
    const entitiesArr = await firstValueFrom(this.entities$);
    const compilation = await firstValueFrom(this.compilation$);
    if (!compilation) return;

    console.log('Before', entitiesArr, index, action);
    const newIndex = (() => {
      if (action === 'move_top') return 0;
      if (action === 'move_up') return Math.max(0, index - 1);
      if (action === 'move_down') return Math.min(entitiesArr.length - 1, index + 1);
      if (action === 'move_bottom') return entitiesArr.length - 1;
      return index;
    })();
    const entity = entitiesArr.splice(index, 1)[0];
    entitiesArr.splice(newIndex, 0, entity);
    console.log('After', entitiesArr, newIndex, action);

    this.processing.compilation$.next(this.#combineArrayWithCompilation(entitiesArr, compilation));
  }
}
