import MDBReader from 'mdb-reader';
import {setMdbOpener} from './mdbFile';

/** The Access adapter: reads a .mdb/.accdb buffer with mdb-reader (pure JS, no ODBC). */
export function installMdbReader(): void {
  setMdbOpener((buffer) => new MDBReader(buffer));
}
