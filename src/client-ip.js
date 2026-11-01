const net = require('net');

// The site is behind Cloudflare, so req.ip is a Cloudflare server's address, shared by many visitors.
// Cloudflare puts the visitor's real address in the CF-Connecting-IP header. Anyone can send that
// header straight to the server, though, so it's only believed when the request came from Cloudflare.
// Cloudflare's addresses: https://www.cloudflare.com/ips/ (checked October 2026)
const cloudflare = new net.BlockList();
const addRange = (range, type) => {
  const [address, bits] = range.split('/');
  cloudflare.addSubnet(address, Number(bits), type);
};
[
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
  '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
  '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
].forEach((range) => addRange(range, 'ipv4'));
[
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32',
  '2a06:98c0::/29', '2c0f:f248::/32',
].forEach((range) => addRange(range, 'ipv6'));

// "::ffff:1.2.3.4" is an IPv4 address written as IPv6.
const plain = (ip) => (ip || '').replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, '');

function isCloudflare(ip) {
  const type = net.isIP(ip);
  return type !== 0 && cloudflare.check(ip, type === 4 ? 'ipv4' : 'ipv6');
}

// Sets req.clientIp: the visitor's real address.
function clientIp(req, res, next) {
  const proxy = plain(req.ip);
  const visitor = plain(req.get('CF-Connecting-IP'));
  req.clientIp = isCloudflare(proxy) && net.isIP(visitor) ? visitor : proxy;
  next();
}

module.exports = { clientIp };
