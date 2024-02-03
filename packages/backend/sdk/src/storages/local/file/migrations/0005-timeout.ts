import { PROXY_TIMEOUT_DISCONNECTED_DEFAULT } from '@scrapoxy/common';


export const migration = {
    name: '0005-timeout',
    up: async({ context: data }: { context: any }) => {
        for (const project of data.projects ?? []) {
            for (const connector of project.connectors ?? []) {
                if (!connector.proxiesTimeoutDisconnected) {
                    connector.proxiesTimeoutDisconnected = PROXY_TIMEOUT_DISCONNECTED_DEFAULT;
                }
            }
        }
    },
    down: async({ context: data }: { context: any }) => {
        for (const project of data.projects ?? []) {
            for (const connector of project.connectors ?? []) {
                delete connector.proxiesTimeoutDisconnected;
            }
        }
    },
};
