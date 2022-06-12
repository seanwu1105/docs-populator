import { CommonModule } from '@angular/common'
import { Component } from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatDividerModule } from '@angular/material/divider'
import { MatIconModule } from '@angular/material/icon'
import { MatSidenavModule } from '@angular/material/sidenav'
import { MatToolbarModule } from '@angular/material/toolbar'
import { DomSanitizer } from '@angular/platform-browser'
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy'
import { LetModule } from '@ngrx/component'
import { parse } from 'csv/browser/esm/sync'
import { saveAs } from 'file-saver'
import { jsPDF } from 'jspdf'
import * as JSZip from 'jszip'
import {
  BehaviorSubject,
  combineLatest,
  concatMap,
  distinctUntilChanged,
  filter,
  map,
  Observable,
  pairwise,
  startWith,
  switchMap,
  tap,
} from 'rxjs'

@UntilDestroy({ checkProperties: true })
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    MatSidenavModule,
    MatButtonModule,
    MatToolbarModule,
    MatDividerModule,
    MatIconModule,
    LetModule,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  private readonly data$ = new BehaviorSubject('')

  private readonly csv$: Observable<Record<string, string>[]> = this.data$.pipe(
    map(data => parse(data, { columns: true }))
  )

  private readonly template$ = new BehaviorSubject('')

  private readonly pageIndex$ = new BehaviorSubject(0)

  readonly pageNumber$ = this.pageIndex$.pipe(map(index => index + 1))

  readonly populated$ = combineLatest([this.csv$, this.template$]).pipe(
    distinctUntilChanged(),
    filter(([csv, template]) => csv.length > 0 && template.length > 0),
    map(([csv, template]) =>
      csv.map(record => {
        let result = template
        Object.keys(record).forEach(key => {
          result = result.replace(`[[${key}]]`, record[key])
        })
        return result
      })
    ),
    startWith([])
  )

  readonly pdf$ = combineLatest([this.populated$, this.pageIndex$]).pipe(
    distinctUntilChanged(),
    filter(
      ([populated, pageNumber]) =>
        populated.length > 0 && pageNumber < populated.length
    ),
    switchMap(([populated, pageNumber]) => generatePdf(populated[pageNumber])),
    map(doc => doc.output('bloburl').toString()),
    revokePreviousObjectUrl(),
    map(url => this.sanitizer.bypassSecurityTrustResourceUrl(url))
  )

  constructor(private readonly sanitizer: DomSanitizer) {}

  async onDataChange(e: Event) {
    this.pageIndex$.next(0)
    this.data$.next(await readFileInputEvent(e))
  }

  async onTemplateChange(e: Event) {
    this.template$.next(await readFileInputEvent(e))
  }

  nextPage() {
    this.pageIndex$.next(this.pageIndex$.value + 1)
  }

  previousPage() {
    this.pageIndex$.next(this.pageIndex$.value - 1)
  }

  downloadZip() {
    return this.populated$
      .pipe(
        filter(populated => populated.length > 0),
        switchMap(populated => Promise.all(populated.map(generatePdf))),
        map(docs => docs.map(doc => doc.output('blob'))),
        switchMap(blobs => {
          const zip = new JSZip()
          blobs.forEach((blob, index) => zip.file(`${index + 1}.pdf`, blob))
          return zip.generateAsync({ type: 'blob' })
        }),
        map(blob => saveAs(blob, 'docs.zip')),
        untilDestroyed(this)
      )
      .subscribe()
  }
}

async function generatePdf(html: string) {
  const A4_WIDTH_PX = 800
  return new Promise<jsPDF>((resolve, _) => {
    const doc = new jsPDF({ unit: 'px', hotfixes: ['px_scaling'] })
    doc.html(html, {
      callback: doc => resolve(doc),
      windowWidth: A4_WIDTH_PX,
      width: A4_WIDTH_PX,
    })
  })
}

async function readFileInputEvent(e: Event) {
  return new Promise<string>((resolve, _) => {
    const t = e.target as HTMLInputElement
    if (t.files === null || t.files.length == 0) return

    const file = t.files.item(0)
    if (file === null) return

    const fileReader = new FileReader()
    fileReader.onload = _ => {
      resolve(fileReader.result as string)
    }
    fileReader.readAsText(file)
  })
}

function revokePreviousObjectUrl() {
  return (source$: Observable<string>) =>
    source$.pipe(
      startWith(undefined),
      pairwise(),
      tap(([previous]) => {
        if (previous) URL.revokeObjectURL(previous)
      }),
      concatMap(() => source$)
    )
}
