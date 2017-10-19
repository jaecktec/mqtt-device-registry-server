import { Server } from './server';
import * as debugFn from 'debug';

const debug = debugFn('index.ts');

Server.bootstrap('mqtt://mosquitto.mqtt-dr-server-stack.4f37f17d.svc.dockerapp.io');

debug('Application started');