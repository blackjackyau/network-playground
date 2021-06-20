# Nginx Load Balancing
- Nginx can be configured as both Level 4(TCP|stream) and Level 7 load balancing (Applicaiton|http)
- L7 LB terminates the incoming TCP connection and to create creates new TCP connection (outbound) to the upstream server. (isolation on request connection)
  - remoteIp will be the LB's IP, client ip/incoming ip can be retrieved via `X-Forwarded-For`. Configured via `proxy_set_header X-Forwarded-For $remote_addr;`
- L4 LB stream through the request
- it might be possible to terminate the incoming connection but not sure if it is doable from Nginx

### Playground Setup
- Nginx with both L7 and L4 LB setup
- L7 with port 8888, L4 with port 8889
- For upstream server, do bring up two node instances to simulate the LB behaviour (default to port 8888), use `set PORT=9999` (window) or `PORT=9999` (linux) then `npm start`

### Persistent/Keepalive Connection
- As L7 LB allows the configuration of persistent connect (http reuse), which is via the keepalive configuration
```
upstream application {
  server 10.0.2.2:8888; # add max_conns to limit connection per server, return 502 Bad Gateway if connection is in used (queue is not available on Nginx community version)
  keepalive 10; # total maximum keep alive idle connection per worker process
}
keepalive_requests 10; # total number of keep alive connection reuse
keepalive_timeout 5; # how long to keep alive will stay on idle
proxy_http_version     1.1;
proxy_set_header Connection "";
```
- [queue info](https://nginx.org/en/docs/http/ngx_http_upstream_module.html#queue)

#### Persistent/Keepalive Connection Testing
- To test persistent connection/keepalive on both L7 L4 LB, we can make use of curl command with multiple request urls
```
$ curl http://docker.vm:8888/api/user?timeout=1 http://docker.vm:8888/api/user?timeout=1
{"name":"lalaking","age":10,"timeout":1000,"server-identifier":8888}{"name":"lalaking","age":10,"timeout":1000,"server-identifier":"9999"}
```
- For L7 LB, The keepalive connection from caller does not affect the LB strategy, as the server maintains its own connections to the upstream server
```
$ curl http://docker.vm:8889/api/user?timeout=1 http://docker.vm:8889/api/user?timeout=1
{"name":"lalaking","age":10,"timeout":1000,"server-identifier":8888}{"name":"lalaking","age":10,"timeout":1000,"server-identifier":8888}
```
- For L4 LB, The keepalive connection from caller affects the LB strategy, request will be routed to the same server when the connection is persist for reuse.
- When there's connection failure due to Server outage, Nginx will detect the failure and switch the request to another upstream instance
```
// Kill the process with it was serving the 10 seconds timeout request, able to switch to another instance
$ curl http://docker.vm:8889/api/user?timeout=1 http://docker.vm:8889/api/user?timeout=10 http://docker.vm:8889/api/user?timeout=1
{"name":"lalaking","age":10,"timeout":1000,"server-identifier":8888}{"name":"lalaking","age":10,"timeout":10000,"server-identifier":"9999"}{"name":"lalaking","age":10,"timeout":1000,"server-identifier":"9999"}
```

### Http Pipelining
- Http Pipelining is a feature on top of persistent connection that allows concurrent http requests to be sent over.
- Http Pipelining will gurantee the order of a request (FIFO)
  - A -> B -> C = A -> B -> C, eventhough B finished processing
- Http pipelining can be in two forms

#### Combined Requests
- `(echo -en "GET /api/user?correlation=1 HTTP/1.1\nHost: 172.17.0.1\n\nGET /api/user?correlation=2 HTTP/1.1\nHost: 172.17.0.1\n\n"; sleep 20) | telnet 172.17.0.1 8888`
- wireshark capture `filter = (tcp.dstport ==8888) || (tcp.srcport == 8888)`
```
9	1.532831	127.0.0.1	127.0.0.1	TCP	56	21348 → 8888 [SYN] Seq=0 Win=65535 Len=0 MSS=65495 WS=256 SACK_PERM=1	21348	8888
10	1.532925	127.0.0.1	127.0.0.1	TCP	56	8888 → 21348 [SYN, ACK] Seq=0 Ack=1 Win=65535 Len=0 MSS=65495 WS=256 SACK_PERM=1	8888	21348
11	1.532999	127.0.0.1	127.0.0.1	TCP	44	21348 → 8888 [ACK] Seq=1 Ack=1 Win=2619648 Len=0	21348	8888
12	1.533341	127.0.0.1	127.0.0.1	HTTP	160	GET /api/user?correlation=1 HTTP/1.1 GET /api/user?correlation=2 HTTP/1.1 	21348	8888
13	1.533350	127.0.0.1	127.0.0.1	TCP	44	8888 → 21348 [ACK] Seq=1 Ack=117 Win=2619648 Len=0	8888	21348
22	2.716631	127.0.0.1	127.0.0.1	HTTP/JSON	407	HTTP/1.1 200 OK , JavaScript Object Notation (application/json)	8888	21348
23	2.716701	127.0.0.1	127.0.0.1	TCP	44	21348 → 8888 [ACK] Seq=117 Ack=364 Win=2619392 Len=0	21348	8888
36	11.240086	127.0.0.1	127.0.0.1	HTTP/JSON	407	HTTP/1.1 200 OK , JavaScript Object Notation (application/json)	8888	21348
37	11.240118	127.0.0.1	127.0.0.1	TCP	44	21348 → 8888 [ACK] Seq=117 Ack=727 Win=2618880 Len=0	21348	8888
```
- observed line 12 where 2 requests are sent in a network packets

#### Continuation requests
- can be simulated by manual telnet. Copy Http command in clipboard, paste after telnet command `telnet 172.17.0.1:8888`
```
GET /api/user?correlation=1 HTTP/1.1
Host: 172.17.0.1

```
- wireshark capture `filter = (tcp.dstport ==8888) || (tcp.srcport == 8888)`
```
13	1.816371	127.0.0.1	127.0.0.1	TCP	56	1041 → 8888 [SYN] Seq=0 Win=65535 Len=0 MSS=65495 WS=256 SACK_PERM=1	1041	8888
14	1.816410	127.0.0.1	127.0.0.1	TCP	56	8888 → 1041 [SYN, ACK] Seq=0 Ack=1 Win=65535 Len=0 MSS=65495 WS=256 SACK_PERM=1	8888	1041
15	1.816432	127.0.0.1	127.0.0.1	TCP	44	1041 → 8888 [ACK] Seq=1 Ack=1 Win=2619648 Len=0	1041	8888
48	6.269508	127.0.0.1	127.0.0.1	HTTP	102	GET /api/user?correlation=1 HTTP/1.1 	1041	8888
49	6.269522	127.0.0.1	127.0.0.1	TCP	44	8888 → 1041 [ACK] Seq=1 Ack=59 Win=2619648 Len=0	8888	1041
70	10.273539	127.0.0.1	127.0.0.1	HTTP	102	GET /api/user?correlation=2 HTTP/1.1 	1041	8888
71	10.273554	127.0.0.1	127.0.0.1	TCP	44	8888 → 1041 [ACK] Seq=1 Ack=117 Win=2619648 Len=0	8888	1041
84	14.264225	127.0.0.1	127.0.0.1	HTTP/JSON	408	HTTP/1.1 200 OK , JavaScript Object Notation (application/json)	8888	1041
85	14.264291	127.0.0.1	127.0.0.1	TCP	44	1041 → 8888 [ACK] Seq=117 Ack=365 Win=2619392 Len=0	1041	8888
90	18.399986	127.0.0.1	127.0.0.1	HTTP/JSON	407	HTTP/1.1 200 OK , JavaScript Object Notation (application/json)	8888	1041
91	18.400043	127.0.0.1	127.0.0.1	TCP	44	1041 → 8888 [ACK] Seq=117 Ack=728 Win=2618880 Len=0	1041	8888
104	23.400454	127.0.0.1	127.0.0.1	TCP	44	8888 → 1041 [FIN, ACK] Seq=728 Ack=117 Win=2619648 Len=0	8888	1041
105	23.400488	127.0.0.1	127.0.0.1	TCP	44	1041 → 8888 [ACK] Seq=117 Ack=729 Win=2618880 Len=0	1041	8888
106	23.401484	127.0.0.1	127.0.0.1	TCP	44	1041 → 8888 [FIN, ACK] Seq=117 Ack=729 Win=2618880 Len=0	1041	8888
107	23.401527	127.0.0.1	127.0.0.1	TCP	44	8888 → 1041 [ACK] Seq=729 Ack=118 Win=2619648 Len=0	8888	1041
```

### Nginx on Http Pipelining
- By default, Nginx inbound connection supports http pipelining, similar like most of the web application that comply to http 1.1.
- Pipelining connection can be captured from the log using `$pipe` variable, return `p` for pipelining request.
```
$connection $connection_requests $pipe
15 1 .
15 2 p
```
- Nginx level 7 LB (http) proxy connection (outbound) does not support http pipelining, even if the request is pipelined, it will split it into two different connections (either new connection or reuse)
```
13	8.633265	127.0.0.1	127.0.0.1	TCP	56	1030 → 8888 [SYN] Seq=0 Win=65535 Len=0 MSS=65495 WS=256 SACK_PERM=1	1030	8888
14	8.633317	127.0.0.1	127.0.0.1	TCP	56	8888 → 1030 [SYN, ACK] Seq=0 Ack=1 Win=65535 Len=0 MSS=65495 WS=256 SACK_PERM=1	8888	1030
15	8.633387	127.0.0.1	127.0.0.1	TCP	44	1030 → 8888 [ACK] Seq=1 Ack=1 Win=2619648 Len=0	1030	8888
16	8.633818	127.0.0.1	127.0.0.1	HTTP	134	GET /api/user?correlation=1 HTTP/1.1 	1030	8888
17	8.633837	127.0.0.1	127.0.0.1	TCP	44	8888 → 1030 [ACK] Seq=1 Ack=91 Win=2619648 Len=0	8888	1030
30	14.758890	127.0.0.1	127.0.0.1	HTTP/JSON	407	HTTP/1.1 200 OK , JavaScript Object Notation (application/json)	8888	1030
31	14.758948	127.0.0.1	127.0.0.1	TCP	44	1030 → 8888 [ACK] Seq=91 Ack=364 Win=2619392 Len=0	1030	8888
32	14.760624	127.0.0.1	127.0.0.1	HTTP	134	GET /api/user?correlation=2 HTTP/1.1 	1030	8888
33	14.760686	127.0.0.1	127.0.0.1	TCP	44	8888 → 1030 [ACK] Seq=364 Ack=181 Win=2619648 Len=0	8888	1030
46	19.023135	127.0.0.1	127.0.0.1	HTTP/JSON	407	HTTP/1.1 200 OK , JavaScript Object Notation (application/json)	8888	1030
47	19.023193	127.0.0.1	127.0.0.1	TCP	44	1030 → 8888 [ACK] Seq=181 Ack=727 Win=2618880 Len=0	1030	8888

```
- However, Nginx level 4 (stream) LB proxy connection (outbound) allow http pipelining as it does not modify the network packet

### Remarks
- Http pipelining are almost deprecated now and be replaced by Http 2.0 for most of the browser application due to challenges/implication of the FIFO behaviours (Response must follow request order)

### References
- [Docker image github](https://github.com/tekn0ir/nginx-stream)
- [Level 4 and 7 LB](https://www.nginx.com/resources/glossary/layer-7-load-balancing/)
- [TCP Http LB](https://medium.com/martinomburajr/distributed-computing-tcp-vs-http-s-load-balancing-7b3e9efc6167)
- [Nginx variables ($pipe)](https://nginx.org/en/docs/http/ngx_http_core_module.html#listen)
- [Stackoverflow Http Pipelining Disadvantages](https://stackoverflow.com/questions/14810890/what-are-the-disadvantages-of-using-http-pipelining)
- [Stackoverflow Http Pipelining browser disabled](https://stackoverflow.com/questions/30477476/why-is-pipelining-disabled-in-modern-browsers?noredirect=1&lq=1)
- [Http pipelining command](https://gist.github.com/ArtemGr/5490781)
