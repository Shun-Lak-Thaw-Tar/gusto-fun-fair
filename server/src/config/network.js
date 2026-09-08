// Nginx must run on this machine and overwrite forwarding headers.
// Trust exactly the nearest proxy, and only if its socket address is loopback.
export const trustLocalNginx = (address, hop) => hop === 0 &&
  ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);

export const networkConfig = nodeEnv => ({
  host: nodeEnv === 'production' ? '127.0.0.1' : '0.0.0.0',
  trustProxy: nodeEnv === 'production' ? trustLocalNginx : false,
});
