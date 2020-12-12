//#region @backend
import * as path from 'path';
import * as child from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import chalk from 'chalk';
import * as rimraf from 'rimraf';
import * as dateformat from 'dateformat';

//#endregion

import * as JSON5 from 'json5';
import * as _ from 'lodash';


import { Helpers as HelpersNg2Rest } from 'ng2-rest';
import { SYMBOL } from './symbols';
import { Models } from './models';

//#region @backend
import { Response as ExpressResponse, Request as ExpressRequest } from 'express';
//#endregion
import { CLASS } from 'typescript-class-helpers';

export class Helpers extends HelpersNg2Rest {

  //#region @backend
  static get System() {

    return {
      get Operations() {
        return {
          tryRemoveDir(dirpath) {
            rimraf.sync(dirpath);
          },

          tryCopyFrom(source, destination, options = {}) {
            // console.log(`Trying to copy from hahah: ${source} to ${destination}`)
            fse.copySync(source, destination, _.merge({
              overwrite: true,
              recursive: true
            }, options));
          }
        }
      }
    }
  }
  //#endregion

  static isGoodPath(p: string) {
    return p && typeof p === 'string' && p.trim() !== ''
  }

  static getPathFor(target: Function) {
    const configs = CLASS.getConfig(target) as any[];
    // console.log(`Class config for ${CLASS.getName(target)}`, configs)
    const classConfig: Models.Rest.ClassConfig = configs[0];
    const parentscalculatedPath = _
      .slice(configs, 1)
      .reverse()
      .map(bc => {
        if (Helpers.isGoodPath(bc.path)) {
          return bc.path
        }
        return CLASS.getName(bc.classReference);
      }).join('/');

    return `/${parentscalculatedPath}/${CLASS.getName(target)}`;
  }

  static hasParentClassWithName(target: Function, name: string, targets = []): boolean {
    if (!target) {
      // console.log(`false "${_.first(targets).name}" for ${targets.map(d => d.name).join(',')}`)
      return false;
    }
    targets.push(target)
    let targetProto = target['__proto__'] as Function;
    if (_.isFunction(targetProto) && CLASS.getName(targetProto) === name) {
      // console.log(`true  "${_.first(targets).name}" for ${targets.map(d => d.name).join(',')}`)
      return true;
    }
    return this.hasParentClassWithName(targetProto, name, targets);
  }

  //#region @backend
  static async compilationWrapper(fn: () => void, taskName: string = 'Task', executionType: 'Compilation' | 'Code execution' = 'Compilation') {
    function currentDate() {
      return `[${dateformat(new Date(), 'HH:MM:ss')}]`;
    }
    if (!fn || !_.isFunction(fn)) {
      console.error(`${executionType} wrapper: "${fs}" is not a function.`)
      process.exit(1)
    }

    try {
      console.log(chalk.gray(`${currentDate()} ${executionType} of "${chalk.bold(taskName)}" started...`))
      await Helpers.runSyncOrAsync(fn)
      console.log(chalk.green(`${currentDate()} ${executionType} of "${chalk.bold(taskName)}" finish OK...`))
    } catch (error) {
      console.log(chalk.red(error));
      console.log(`${currentDate()} ${executionType} of ${taskName} ERROR`)
    }

  }
  //#endregion


  static runSyncOrAsync(fn: Function) {
    // let wasPromise = false;
    let promisOrValue = fn()
    if (promisOrValue instanceof Promise) {
      // wasPromise = true;
      promisOrValue = Promise.resolve(promisOrValue)
    }
    // console.log('was promis ', wasPromise)
    return promisOrValue;
  }



  static tryTransformParam(param) {
    if (typeof param === 'string') {
      let n = Number(param);
      if (!isNaN(n)) return n;
      const bool = param.trim().toLowerCase();
      if (bool === 'true') {
        return true;
      }
      if (bool === 'false') {
        return false;
      }
      try {
        const t = JSON5.parse(param);
        return t;
      } catch (e) {
        return param;
      }
    }
    return param;
  }

  static getExpressPath(c: Models.Rest.ClassConfig, pathOrClassConfig: Models.Rest.MethodConfig | string) {
    if (typeof pathOrClassConfig === 'string') return `${c.calculatedPath}${pathOrClassConfig}`.replace(/\/$/, '')
    return `${c.calculatedPath}${pathOrClassConfig.path}`.replace(/\/$/, '')
  }

  static defaultType(value) {
    if (typeof value === 'string') return '';
    if (typeof value === 'boolean') return false;
    if (Array.isArray(value)) return {};
    if (typeof value === 'object') return {};
  }

  static parseJSONwithStringJSONs(object: Object, waring = false): Object {
    // console.log('checking object', object)
    if (!_.isObject(object)) {
      if (waring) {
        console.error(`
        parseJSONwithStringJSONs(...)
        Parameter should be a object, but is ${typeof object}
        `, object)
      }

      return object;
    }

    let res = _.cloneDeep(object);

    Object.keys(res).forEach(key => {
      let isJson = false;
      try {
        const possibleJSON = JSON.parse(res[key]);
        res[key] = possibleJSON;
        isJson = true;
      } catch (e) {
        isJson = false;
      }
      // console.log(`key ${key} is json `, isJson)
      if (isJson) {
        res[key] = this.parseJSONwithStringJSONs(res[key], false)
      }
    });

    return res;
  }




  //#region @backend




  static getResponseValue<T>(response: Models.Response<T>, req: ExpressRequest, res: ExpressResponse): Promise<Models.SyncResponse<T>> {
    //#region @backendFunc
    return new Promise<Models.SyncResponse<T>>(async (resolve, reject) => {
      const resp: Models.__Response<T> = response;
      if (!response && response.send === undefined) {
        console.error('Bad response value for function');
        resolve(undefined);
      }
      else if (typeof response === 'function') {
        const asyncResponse: Models.AsyncResponse<T> = response as any;
        try {
          const result = await asyncResponse(req, res);
          resolve(result as any);
        } catch (e) {
          if (e && e.stack) {
            console.log(e.stack)
          }
          console.error('Bad async function call ', e)
          reject(e);
        }
      } else if (typeof response === 'object') {
        try {
          if (typeof response.send === 'function') {
            const result = (response as any).send(req, res) as any
            resolve(result)
          } else {
            resolve(response.send as any)
          }
        } catch (error) {
          console.error('Bad synchonus function call ', error)
          reject(error);
        }
      } else reject(`Not recognized type of reposne ${response}`);
    });
    //#endregion
  }

  static isPlainFileOrFolder(filePath) {
    return /^([a-zA-Z]|\-|\_|\@|\#|\$|\!|\^|\&|\*|\(|\))+$/.test(filePath);
  }

  static log(proc: child.ChildProcess, stdoutMsg?: string | string[], stderMsg?: string | string[]) {
    // processes.push(proc);
    let isResolved = false;

    if (_.isString(stdoutMsg)) {
      stdoutMsg = [stdoutMsg];
    }
    if (_.isString(stderMsg)) {
      stderMsg = [stderMsg];
    }

    return new Promise((resolve, reject) => {

      // let stdio = [0,1,2]
      proc.stdout.on('data', (message) => {
        process.stdout.write(message);
        const data: string = message.toString().trim();

        if (!isResolved && _.isArray(stdoutMsg)) {
          for (let index = 0; index < stdoutMsg.length; index++) {
            const m = stdoutMsg[index];
            if ((data.search(m) !== -1)) {
              // Helpers.info(`[unitlOutputContains] Move to next step...`)
              isResolved = true;
              resolve(void 0);
              break;
            }
          }
        }
        if (!isResolved && _.isArray(stderMsg)) {
          for (let index = 0; index < stderMsg.length; index++) {
            const rejectm = stderMsg[index];
            if ((data.search(rejectm) !== -1)) {
              // Helpers.info(`[unitlOutputContains] Rejected move to next step...`);
              isResolved = true;
              reject();
              proc.kill('SIGINT');
              break;
            }
          }
        }

        // console.log(data.toString());
      })

      proc.stdout.on('error', (data) => {
        process.stdout.write(JSON.stringify(data))
        // console.log(data);
      })

      proc.stderr.on('data', (message) => {
        process.stderr.write(message);
        // console.log(data.toString());
        const data: string = message.toString().trim();
        if (!isResolved && _.isArray(stderMsg)) {
          for (let index = 0; index < stderMsg.length; index++) {
            const rejectm = stderMsg[index];
            if ((data.search(rejectm) !== -1)) {
              // Helpers.info(`[unitlOutputContains] Rejected move to next step...`);
              isResolved = true;
              reject();
              proc.kill('SIGINT');
              break;
            }
          }
        }

      })

      proc.stderr.on('error', (data) => {
        process.stderr.write(JSON.stringify(data))
        // console.log(data);
      });
    });

  }

  static createLink(target: string, link: string) {
    if (this.isPlainFileOrFolder(link)) {
      link = path.join(process.cwd(), link);
    }

    let command: string;
    if (os.platform() === 'win32') {

      if (target.startsWith('./')) {
        target = path.win32.normalize(path.join(process.cwd(), path.basename(target)))
      } else {
        if (target === '.' || target === './') {
          target = path.win32.normalize(path.join(process.cwd(), path.basename(link)))
        } else {
          target = path.win32.normalize(path.join(target, path.basename(link)))
        }
      }
      if (fs.existsSync(target)) {
        fs.unlinkSync(target);
      }
      target = path.win32.normalize(target)
      if (link === '.' || link === './') {
        link = process.cwd()
      }
      link = path.win32.normalize(link)
      // console.log('taget', target)
      // console.log('link', link)
      command = "mklink \/D "
        + target
        + " "
        + link
        + " >nul 2>&1 "
      // console.log('LINK COMMAND', command)
    } else {
      if (target.startsWith('./')) {
        target = target.replace(/^\.\//g, '');
      }
      if (link === '.' || link === './') {
        link = process.cwd()
      }
      command = `ln -sf "${link}" "${target}"`;
    }
    // console.log(command)
    return command;
  }


  static getRecrusiveFilesFrom(dir): string[] {
    let files = [];
    const readed = fs.readdirSync(dir).map(f => {
      const fullPath = path.join(dir, f);
      // console.log(`is direcotry ${fs.lstatSync(fullPath).isDirectory()} `, fullPath)
      if (fs.lstatSync(fullPath).isDirectory()) {
        this.getRecrusiveFilesFrom(fullPath).forEach(aa => files.push(aa))
      }
      return fullPath;
    })
    if (Array.isArray(readed)) {
      readed.forEach(r => files.push(r))
    }
    return files;
  }

  //#endregion



}
