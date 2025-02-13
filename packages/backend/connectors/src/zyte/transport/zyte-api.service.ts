import {
    IncomingMessage,
    request,
} from 'http';
import { Socket } from 'net';
import { connect } from 'tls';
import { Injectable } from '@nestjs/common';
import {
    ATransportService,
    createConnectionAuto,
    HttpTransportError,
    isUrl,
    TransportprovidersService,
    urlOptionsToUrl,
} from '@scrapoxy/backend-sdk';
import { SCRAPOXY_HEADER_PREFIX_LC } from '@scrapoxy/common';
import { TRANSPORT_ZYTE_API_TYPE } from './zyte.constants';
import { parseApiUrl } from './zyte.helpers';
import type { IProxyToConnectConfigZyte } from './zyte.interface';
import type {
    IConnectorZyteConfig,
    IConnectorZyteCredential,
} from '../zyte.interface';
import type {
    ArrayHttpHeaders,
    IUrlOptions,
} from '@scrapoxy/backend-sdk';
import type {
    IConnectorProxyRefreshed,
    IConnectorToRefresh,
    IProxyToConnect,
    IProxyToRefresh,
} from '@scrapoxy/common';
import type { ISockets } from '@scrapoxy/proxy-sdk';
import type {
    ClientRequestArgs,
    OutgoingHttpHeaders,
} from 'http';
import type { ConnectionOptions } from 'tls';


@Injectable()
export class TransportZyteApiService extends ATransportService {
    readonly type = TRANSPORT_ZYTE_API_TYPE;

    constructor(transportproviders: TransportprovidersService) {
        super();

        transportproviders.register(this);
    }

    completeProxyConfig(
        proxy: IConnectorProxyRefreshed, connector: IConnectorToRefresh
    ) {
        const proxyConfig = proxy.config as IProxyToConnectConfigZyte;
        const credentialConfig = connector.credentialConfig as IConnectorZyteCredential;
        proxyConfig.token = credentialConfig.token;

        const connectorConfig = connector.connectorConfig as IConnectorZyteConfig;
        proxyConfig.region = connectorConfig.region;
        proxyConfig.apiUrl = connectorConfig.apiUrl;
    }

    buildRequestArgs(
        method: string | undefined,
        urlOpts: IUrlOptions,
        headers: ArrayHttpHeaders,
        headersConnect: OutgoingHttpHeaders,
        proxy: IProxyToConnect,
        sockets: ISockets
    ): ClientRequestArgs {
        const config = proxy.config as IProxyToConnectConfigZyte;
        const auth = btoa(`${config.token}:`);

        switch (urlOpts.protocol) {
            case 'https:': {
                return this.buildRequestArgsHttps(
                    method,
                    urlOpts,
                    headers,
                    headersConnect,
                    proxy,
                    config,
                    auth,
                    sockets
                );
            }

            case 'http:': {
                return this.buildRequestArgsHttp(
                    method,
                    urlOpts,
                    headers,
                    proxy,
                    config,
                    auth,
                    sockets
                );
            }

            default: {
                throw new Error(`Zyte: Unsupported protocol: ${urlOpts.protocol}`);
            }
        }
    }

    buildFingerprintRequestArgs(
        method: string | undefined,
        urlOpts: IUrlOptions,
        headers: ArrayHttpHeaders,
        headersConnect: OutgoingHttpHeaders,
        proxy: IProxyToRefresh,
        sockets: ISockets
    ): ClientRequestArgs {
        return this.buildRequestArgs(
            method,
            urlOpts,
            headers,
            headersConnect,
            proxy,
            sockets
        );
    }

    connect(
        url: string,
        headers: OutgoingHttpHeaders,
        proxy: IProxyToConnect,
        sockets: ISockets,
        callback: (err: Error, socket: Socket) => void
    ) {
        const config = proxy.config as IProxyToConnectConfigZyte;
        const auth = btoa(`${config.token}:`);

        headers[ 'Proxy-Authorization' ] = `Basic ${auth}`;
        headers[ 'Zyte-Session-ID' ] = proxy.key;

        if (config.region !== 'all') {
            headers[ 'Zyte-Geolocation' ] = config.region;
        }

        const { hostname, port } = parseApiUrl(config.apiUrl);
        const proxyReq = request({
            method: 'CONNECT',
            hostname,
            port,
            path: url,
            headers,
            timeout: proxy.timeoutDisconnected,
            createConnection: (
                opts,
                oncreate
            ) => createConnectionAuto(
                opts,
                oncreate,
                sockets,
                'TransportZyte:connect'
            ),
        });

        proxyReq.on(
            'error',
            (err: any) => {
                callback(
                    err,
                    void 0 as any
                );
            }
        );

        proxyReq.on(
            'connect',
            (
                proxyRes: IncomingMessage, socket: Socket
            ) => {
                if (proxyRes.statusCode === 200) {
                    callback(
                        void 0 as any,
                        socket
                    );
                } else {
                    callback(
                        new HttpTransportError(
                            proxyRes.statusCode,
                            proxyRes.headers[ `${SCRAPOXY_HEADER_PREFIX_LC}-proxyerror` ] as string || proxyRes.statusMessage as string
                        ),
                        void 0 as any
                    );
                }
            }
        );

        proxyReq.end();
    }

    private buildRequestArgsHttp(
        method: string | undefined,
        urlOpts: IUrlOptions,
        headers: ArrayHttpHeaders,
        proxy: IProxyToConnect,
        config: IProxyToConnectConfigZyte,
        auth: string,
        sockets: ISockets
    ): ClientRequestArgs {
        headers.addHeader(
            'Proxy-Authorization',
            `Basic ${auth}`
        );
        headers.addHeader(
            'Zyte-Session-ID',
            proxy.key
        );

        if (config.region !== 'all') {
            headers.addHeader(
                'Zyte-Geolocation',
                config.region
            );
        }

        const { hostname, port } = parseApiUrl(config.apiUrl);

        return {
            method,
            hostname,
            port,
            path: urlOptionsToUrl(
                urlOpts,
                true
            ),
            headers: headers.toArray() as any, // should accept also [string, string][]
            timeout: proxy.timeoutDisconnected,
            createConnection: (
                opts,
                oncreate
            ) => createConnectionAuto(
                opts,
                oncreate,
                sockets,
                'TransportZyte:buildRequestArgs'
            ),
        };
    }

    private buildRequestArgsHttps(
        method: string | undefined,
        urlOpts: IUrlOptions,
        headers: ArrayHttpHeaders,
        headersConnect: OutgoingHttpHeaders,
        proxy: IProxyToConnect,
        config: IProxyToConnectConfigZyte,
        auth: string,
        sockets: ISockets
    ): ClientRequestArgs {
        const { hostname, port } = parseApiUrl(config.apiUrl);

        headers.addHeader(
            'Zyte-Session-ID',
            proxy.key
        );

        if (config.region !== 'all') {
            headers.addHeader(
                'Zyte-Geolocation',
                config.region
            );
        }

        return {
            method,
            hostname,
            port,
            path: urlOptionsToUrl(
                urlOpts,
                false
            ),
            headers: headers.toArray() as any, // should accept also [string, string][]
            timeout: headers.parseKeepAliveTimeout(proxy.timeoutDisconnected),
            createConnection: (
                args,
                oncreate
            ) => {
                headersConnect[ 'Proxy-Authorization' ] = `Basic ${auth}`;

                const proxyReqArgs: ClientRequestArgs = {
                    method: 'CONNECT',
                    hostname: args.hostname,
                    port: args.port,
                    path: headersConnect.Host as string,
                    headers: headersConnect,
                    timeout: proxy.timeoutDisconnected,
                    createConnection: (
                        args2,
                        oncreate2
                    ) => createConnectionAuto(
                        args2,
                        oncreate2,
                        sockets,
                        'TransportZyteService:https:buildRequestArgs'
                    ),
                };
                const proxyReq = request(proxyReqArgs);
                proxyReq.on(
                    'error',
                    (err: any) => {
                        oncreate(
                            err,
                            void 0 as any
                        );
                    }
                );

                proxyReq.on(
                    'connect',
                    (
                        proxyRes: IncomingMessage, proxySocket: Socket
                    ) => {
                        proxyRes.on(
                            'error',
                            (err: any) => {
                                oncreate(
                                    err,
                                    void 0 as any
                                );
                            }
                        );

                        proxySocket.on(
                            'error',
                            (err: any) => {
                                oncreate(
                                    err,
                                    void 0 as any
                                );
                            }
                        );

                        proxyReq.on(
                            'close',
                            () => {
                                sockets.remove(proxySocket);
                            }
                        );

                        if (proxyRes.statusCode !== 200) {
                            this.parseBodyError(
                                proxyRes,
                                (err: any) => {
                                    oncreate(
                                        err,
                                        void 0 as any
                                    );
                                }
                            );

                            return;
                        }

                        const options: ConnectionOptions = {
                            socket: proxySocket,
                            requestCert: true,
                            rejectUnauthorized: false,
                            timeout: proxy.timeoutDisconnected,
                        };

                        if (isUrl(urlOpts.hostname)) {
                            options.servername = urlOpts.hostname as string;
                        }

                        if (proxy.ciphers) {
                            options.ciphers = proxy.ciphers;
                        }

                        const returnedSocket = connect(options);
                        returnedSocket.on(
                            'error',
                            (err: any) => {
                                oncreate(
                                    err,
                                    void 0 as any
                                );
                            }
                        );

                        returnedSocket.on(
                            'close',
                            () => {
                                sockets.remove(returnedSocket);
                            }
                        );
                        sockets.add(
                            returnedSocket,
                            'TransportZyteService:buildRequestArgs:createConnection:connect'
                        );

                        returnedSocket.on(
                            'timeout',
                            () => {
                                returnedSocket.destroy();
                                returnedSocket.emit('close');
                            }
                        );

                        oncreate(
                            void 0 as any,
                            returnedSocket
                        );
                    }
                );

                proxyReq.end();

                return void 0 as any;
            },
        };
    }
}
