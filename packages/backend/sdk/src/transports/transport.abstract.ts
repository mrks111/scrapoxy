import { IncomingMessage } from 'http';
import type {
    ArrayHttpHeaders,
    IUrlOptions,
} from '../helpers';
import type {
    IConnectorProxyRefreshed,
    IConnectorToRefresh,
    IFingerprint,
    IFingerprintResponseRaw,
    IProxyToConnect,
    IProxyToRefresh,
} from '@scrapoxy/common';
import type { ISockets } from '@scrapoxy/proxy-sdk';
import type {
    ClientRequestArgs,
    OutgoingHttpHeaders,
} from 'http';
import type { Socket } from 'net';


export abstract class ATransportService {
    abstract type: string;

    abstract completeProxyConfig(
        proxy: IConnectorProxyRefreshed, connector: IConnectorToRefresh
    ): void;

    abstract buildRequestArgs(
        method: string | undefined,
        urlOpts: IUrlOptions,
        headers: ArrayHttpHeaders,
        headersConnect: OutgoingHttpHeaders,
        proxy: IProxyToConnect,
        sockets: ISockets,
    ): ClientRequestArgs;

    abstract buildFingerprintRequestArgs(
        method: string | undefined,
        urlOpts: IUrlOptions,
        headers: ArrayHttpHeaders,
        headersConnect: OutgoingHttpHeaders,
        proxy: IProxyToRefresh,
        sockets: ISockets,
    ): ClientRequestArgs;

    abstract connect(
        url: string,
        headers: OutgoingHttpHeaders,
        proxy: IProxyToConnect,
        sockets: ISockets,
        callback: (err: Error, socket: Socket) => void
    ): void;

    parseFingerprintResponse(response: IFingerprintResponseRaw): IFingerprint {
        const body = JSON.parse(response.body);

        return body as IFingerprint;
    }

    protected parseBodyError(
        r: IncomingMessage, callback: (err: Error) => void
    ) {
        const buffers: Buffer[] = [];
        r.on(
            'error',
            (err: any) => {
                callback(err);
            }
        );
        r.on(
            'end',
            () => {
                const body = Buffer.concat(buffers)
                    .toString();
                callback(new Error(body));
            }
        );
        r.on(
            'data',
            (chunk) => buffers.push(chunk)
        );
    }
}
