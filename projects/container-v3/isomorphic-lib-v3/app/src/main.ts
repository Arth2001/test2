import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { Helpers } from 'tnp-core';  // <- this is to replace by firedev

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

async function init() {
  if (Helpers.isWebSQL) { // @ts-ignore
    const initSqlJs = require('sql.js');
    // or if you are in a browser:
    // const initSqlJs = window.initSqlJs;

    const SQL = await initSqlJs({
      // Required to load the wasm binary asynchronously. Of course, you can host it wherever you want
      // You can omit locateFile completely when running in node
      // @ts-ignore
      locateFile: file => {
        const basename = '<<<TO_REPLACE_BASENAME>>>'
        const wasmPath = `${window.location.origin}${basename}/assets/${file}`;
        console.log(`Trying to get sql.js wasm from: ${wasmPath}`)
        return wasmPath;
        // return `https://sql.js.org/dist/${file}`
      }
    });

    // @ts-ignore
    window['SQL'] = SQL;
    console.log('WEBSQL LOADED');
  } else {
    console.log('WEBSQL NOT LOADED')
  }
  platformBrowserDynamic().bootstrapModule(AppModule)
    .catch(err => console.error(err));
}

init();