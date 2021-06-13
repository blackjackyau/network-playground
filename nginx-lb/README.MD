# Nginx Load Balancing
- Nginx can be configured as both Level 4(TCP) and Level 7(Application) balancing
- 

### References
- [Level 4 and 7 LB](https://www.nginx.com/resources/glossary/layer-7-load-balancing/)
- [TCP Http LB](https://medium.com/martinomburajr/distributed-computing-tcp-vs-http-s-load-balancing-7b3e9efc6167)


(echo -en "GET /api/user HTTP/1.1\nHost: docker.vm\n\nGET / HTTP/1.1\nHost: docker.vm\n\n"; sleep 0.1) | telnet localhost 8888

http://docker.vm:8888/api/user

(echo -en "GET /api/user?correlation=1 HTTP/1.1\nHost: 172.17.0.1\n\nGET /api/user?correlation=2 HTTP/1.1\nHost: 172.17.0.1\n\n"; sleep 20 | telnet 172.17.0.1 8888

(echo -en "GET /api/user?correlation=1 HTTP/1.1\nHost: 172.17.0.1\n\nGET /api/user?correlation=2 HTTP/1.1\nHost: 172.17.0.1\n\n"; sleep 20) | telnet 172.17.0.1 8888

curl "http://docker.vm:8888/api/user?correlation=1" & "http://docker.vm:8888/api/user?correlation=2" & "http://docker.vm:8888/api/user?correlation=3" & "http://docker.vm:8888/api/user?correlation=4" & "http://docker.vm:8888/api/user?correlation=5"


curl -w "time %{time_total}s" -o /dev/null "172.17.0.1:8888/api/user?correlation=1" & curl -w "time %{time_total}s" -o /dev/null "172.17.0.1:8888/api/user?correlation=2" & curl -w "time %{time_total}s" -o /dev/null "172.17.0.1:8888/api/user?correlation=3"

 & curl -w "time %{time_total}s" -o /dev/null "172.17.0.1:8888/api/user?correlation=2" & curl -w "time %{time_total}s" -o /dev/null "172.17.0.1:8888/api/user?correlation=3"


for i in {1..10}; do curl -s -w "$i) remoteIp %{remote_ip}, time %{time_total}s, dns time %{time_namelookup} for %{http_code}\n" -o /dev/null http://bps-svc-int1.da-saas-non-prod-11cc93adeee34d56917618786f93447e.svc.cluster.local:80; done


for i in {1..3}; do curl -s -w "[Metadata] index = $i remoteIp %{remote_ip}, dns time %{time_namelookup}, [total time] %{time_total}s for code %{http_code}\n " http://172.17.0.1:8888/api/user?correlation=$i & done


for i in {1..3}; do curl -s -w "[Metadata] index = $i remoteIp %{remote_ip}, dns time %{time_namelookup}, [total time] %{time_total}s for code %{http_code}\n " http://nginx.blax; done


curl "http://docker.vm:8889/api/user?correlation=1" & "http://docker.vm:8889/api/user?correlation=2" & "http://docker.vm:8889/api/user?correlation=3"