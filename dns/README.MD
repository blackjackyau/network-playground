## Setup a DNS Server
- using bind9 with docker ([link](https://github.com/sameersbn/docker-bind))

### Setup
- By default bind9 only allow query from host ip, this setting is not ideal as on docker machine, the proxy endpoint might not be the host ip ( like boot2docker )
- Need to edit the configuration to allow the DNS query
- Login on Web Admin (:10000), navigate to `Servers` -> `BIND DNS Server`-> `Edit Config File` -> Edit cnofig file: `/etc/bind/named.conf.options` -> Add `allow-recursion { any; }; allow-query { any; }; allow-query-cache { any; };` under the `options` json block
-> `Save` and click on `Apply configuration`(right top corner) button to take effect
- test DNS server with `nslookup google.com ${dockerIP}` and should be successful

### Create a DNS entry
- Following the steps [here](http://www.damagehead.com/blog/2015/04/28/deploying-a-dns-server-using-docker/)
- Navigate to `BIND DNS Server` -> `Create Master Zone` with `Forward` domain name = `blackjackyau.local` and `Master server` = `ns.blackjackyau.local`
- Navigate to `BIND DNS Server` -> `Create Master Zone` with `Reverse` domain name = `${dockerIP}` and `Master server` = `ns.blackjackyau.local`
- Go to `blackjackyau.local` master node, create an A record via `Address`. Leave `Name` to blank with `Address` of anything (E.g. 192.168.88.88)
- Go to `blackjackyau.local` master node, create an A record via `Address`. Fill up `Name` with `ns` with Address of to blank with `Address` of anything (E.g. 192.168.88.88)
- Go to `blackjackyau.local` master node, create an CNAME record via `Alias Record`. Fill up `Name` with `www` and `Address` of `.`
- `Apply configuration` or `Apply zone` to take effect
- Testing result
```
$ nslookup blackjackyau.local 192.168.99.100
100.99.168.192.in-addr.arpa
        primary name server = ns.blackjackyau.local
        responsible mail addr = blackjackyau.local
        serial  = 1623135371
        refresh = 10800 (3 hours)
        retry   = 3600 (1 hour)
        expire  = 604800 (7 days)
        default TTL = 38400 (10 hours 40 mins)
Server:  UnKnown
Address:  192.168.99.100

Name:    blackjackyau.local
Address:  192.168.88.88

$ nslookup www.blackjackyau.local 192.168.99.100
100.99.168.192.in-addr.arpa
        primary name server = ns.blackjackyau.local
        responsible mail addr = blackjackyau.local
        serial  = 1623135371
        refresh = 10800 (3 hours)
        retry   = 3600 (1 hour)
        expire  = 604800 (7 days)
        default TTL = 38400 (10 hours 40 mins)
Server:  UnKnown
Address:  192.168.99.100

Name:    www.blackjackyau.local

$ nslookup ns.blackjackyau.local 192.168.99.100
100.99.168.192.in-addr.arpa
        primary name server = ns.blackjackyau.local
        responsible mail addr = blackjackyau.local
        serial  = 1623135371
        refresh = 10800 (3 hours)
        retry   = 3600 (1 hour)
        expire  = 604800 (7 days)
        default TTL = 38400 (10 hours 40 mins)
Server:  UnKnown
Address:  192.168.99.100

Name:    ns.blackjackyau.local
Address:  192.168.99.100

$ nslookup 192.168.99.100 192.168.99.100
100.99.168.192.in-addr.arpa
        primary name server = ns.blackjackyau.local
        responsible mail addr = blackjackyau.local
        serial  = 1623135371
        refresh = 10800 (3 hours)
        retry   = 3600 (1 hour)
        expire  = 604800 (7 days)
        default TTL = 38400 (10 hours 40 mins)
Server:  UnKnown
Address:  192.168.99.100

100.99.168.192.in-addr.arpa
        primary name server = ns.blackjackyau.local
        responsible mail addr = blackjackyau.local
        serial  = 1623135371
        refresh = 10800 (3 hours)
        retry   = 3600 (1 hour)
        expire  = 604800 (7 days)
        default TTL = 38400 (10 hours 40 mins)
*** No internal type for both IPv4 and IPv6 Addresses (A+AAAA) records available for 192.168.99.100

```

#### A record with Multiple IPs
- It is also possible to bind multiple IPs to a single address. Take `blackjackyau.local` for an instance
- Create another A record under `blackjackyau.local` master node with `192.168.88.99`
- `nslookup` should return you two IPs ["192.168.88.88", "192.168.88.99"]

#### Service Record (SRV)
- `SRV` record allow you to publish you service IP together with PORT on DNS server
- `SRV` record is similar like CNAME that requires a reference to A record
- Create an A record of `srv.blackjackyau.local` that maps to `10.0.2.2`
- Go to `blackjackyau.local` master node, create an SRV record via `Service Address Records`. Fill up `Name` with ``, `Service Name` with `app`, `Weight and Priority` to `1`, `Port` with `8888` and `Server` of `.`
- create another SRV record. Fill up `Name` with ``, `Service Name` with `app`, `Weight and Priority` to `1`, `Port` with `9999` and `Server` of `.`
- `Apply configuration` or `Apply zone` to take effect

```
$ nslookup -type=SRV _app._tcp.blackjackyau.local. 192.168.99.100
100.99.168.192.in-addr.arpa
        primary name server = ns.blackjackyau.local
        responsible mail addr = blackjackyau.local
        serial  = 1623135371
        refresh = 10800 (3 hours)
        retry   = 3600 (1 hour)
        expire  = 604800 (7 days)
        default TTL = 38400 (10 hours 40 mins)
Server:  UnKnown
Address:  192.168.99.100

_app._tcp.blackjackyau.local    SRV service location:
          priority       = 1
          weight         = 1
          port           = 8888
          svr hostname   = srv.blackjackyau.local
_app._tcp.blackjackyau.local    SRV service location:
          priority       = 1
          weight         = 1
          port           = 9999
          svr hostname   = srv.blackjackyau.local
srv.blackjackyau.local  internet address = 10.0.2.2
```

### References
- [docker-bind9 git repo](https://github.com/sameersbn/docker-bind)
- [docker-bind9 resolved non host ip dns query](https://github.com/sameersbn/docker-bind/issues/3)
- [the demo write up](http://www.damagehead.com/blog/2015/04/28/deploying-a-dns-server-using-docker/)