import { CommonModule } from '@angular/common'
import { Component } from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatDividerModule } from '@angular/material/divider'
import { MatIconModule } from '@angular/material/icon'
import { MatSidenavModule } from '@angular/material/sidenav'
import { MatToolbarModule } from '@angular/material/toolbar'

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
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  data = ''
  template = ''

  async onDataChange(e: Event) {
    this.data = await readFileInputEvent(e)
    console.log(this.data)
  }

  async onTemplateChange(e: Event) {
    this.template = await readFileInputEvent(e)
    console.log(this.template)
  }
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
