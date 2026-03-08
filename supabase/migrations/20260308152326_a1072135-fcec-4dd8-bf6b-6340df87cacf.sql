
INSERT INTO stacq_ansatte 
  (ansatt_id,navn,tlf,epost,start_dato,slutt_dato,status,kommentar)
VALUES
(1,'Christian Steffen Poljac','40522255','christian@stacq.no','2024-04-01',NULL,'AKTIV/SIGNERT',NULL),
(4,'Kacper Wysocki','94394126','kacper@stacq.no','2024-09-01',NULL,'AKTIV/SIGNERT',NULL),
(5,'Anders Nilsen','91801878','anders@stacq.no','2024-09-01',NULL,'AKTIV/SIGNERT',NULL),
(6,'Henning Thorkildsen','47636878','henning@stacq.no','2024-11-18',NULL,'AKTIV/SIGNERT',NULL),
(7,'Ida Abrahamsson','97630449','ida@stacq.no','2025-01-01',NULL,'AKTIV/SIGNERT',NULL),
(8,'Filip Dovland','40244807','filip@stacq.no','2025-08-01','2025-11-30','SLUTTET','Til Monil'),
(9,'Trine Ødegård Olsen','98665207','trine@stacq.no','2025-09-01',NULL,'AKTIV/SIGNERT',NULL),
(10,'Karl Eirik Bang Fossberg','91116318','karl.eirik@stacq.no','2025-08-01',NULL,'AKTIV/SIGNERT',NULL),
(11,'Mattis Spieler Asp','41244648','mattis@stacq.no','2025-09-01',NULL,'AKTIV/SIGNERT',NULL),
(12,'Lars Rudolfsen','97774718','lars@stacq.no','2025-10-01',NULL,'AKTIV/SIGNERT',NULL),
(13,'Tom Erik Lundesgaard','90545647','tom.erik@stacq.no','2025-11-01',NULL,'AKTIV/SIGNERT',NULL),
(14,'Martin Tysseland','98846933','martin@stacq.no','2026-03-01',NULL,'AKTIV/SIGNERT',NULL),
(15,'Harald Ivarson Moldsvor','93484685','harald@stacq.no','2026-09-01',NULL,'AKTIV/SIGNERT',NULL),
(16,'Rikke Solbjørg','92072825','rikke@stacq.no','2026-04-01',NULL,'AKTIV/SIGNERT',NULL),
(17,'Anders Larsen','41375054','anders.larsen@stacq.no','2026-03-09',NULL,'AKTIV/SIGNERT',NULL),
(18,'Trond Hübertz Emaus','41145548','trond@stacq.no','2026-09-01',NULL,'AKTIV/SIGNERT',NULL);

INSERT INTO stacq_oppdrag
  (oppdrag_id,kandidat,er_ansatt,status,utpris,til_konsulent,kunde,deal_type,start_dato,forny_dato,slutt_dato)
VALUES
(20004,'Anders Strand',false,'Aktiv',1326.5,1200,'7N Norge / KDA Moss','VIA','2024-04-02','2026-06-30',NULL),
(20012,'Anders Nilsen',true,'Aktiv',1500,1050,'Autostore','DIR','2024-09-02','2026-04-30',NULL),
(20016,'Henning Thorkildsen',true,'Aktiv',1548,1083.6,'Cisco','DIR','2024-11-18','2026-04-30',NULL),
(20018,'Christian Steffen Poljac',true,'Aktiv',1600,1120,'Amina Charging AS','DIR','2025-01-02',NULL,NULL),
(20017,'Ida Abrahamsson',true,'Aktiv',1342,910,'Six Robotics','DIR','2025-01-02','2026-12-31',NULL),
(20022,'Trine Ødegård Olsen',true,'Aktiv',1601,1120.7,'Thales','DIR','2025-09-01','2026-12-31',NULL),
(20024,'Lars Ødegård',false,'Aktiv',1663,1506.5,'Cisco','DIR','2025-09-22','2027-09-22',NULL),
(20023,'Mattis Spieler Asp',true,'Aktiv',1450,1015,'Teledyne','VIA','2025-09-01','2026-07-31',NULL),
(20025,'Lars Rudolfsen',true,'Aktiv',1250,910,'Six Robotics','DIR','2025-10-01','2026-12-31',NULL),
(20027,'Kacper Wysocki',true,'Aktiv',1490,1043,'Zivid','DIR','2025-11-17','2026-05-31',NULL),
(20028,'Tom Erik Lundesgaard',true,'Aktiv',1500,1050,'Defa','DIR','2025-12-03',NULL,NULL),
(20029,'Martin Tysseland',true,'Aktiv',1350,945,'Squarehead','DIR','2026-03-02','2026-08-31',NULL),
(20032,'Karl Eirik Bang Fossberg',true,'Aktiv',1439.25,1007.5,'KDA','VIA','2026-03-02','2026-12-31',NULL),
(20031,'Rikke Solbjørg',true,'Oppstart',1350,945,'Nordbit Connectivity','DIR','2026-04-01','2026-09-30',NULL),
(20030,'Anders Larsen',true,'Oppstart',1550,1085,'Tomra ASA','DIR','2026-03-09','2026-09-09',NULL),
(20002,'Andreas Aalsaunet',false,'Inaktiv',1116,1000,'Omegapoint/ForProSolutions',NULL,'2023-09-11','2024-03-01','2024-04-30'),
(20003,'Peyman Shakari',false,'Inaktiv',1450,1250,'DN Nye Medier','DIR','2023-12-11',NULL,'2024-08-30'),
(20006,'Christian Steffen Poljac',true,'Inaktiv',1450,1115,'Silicon Labs','DIR','2024-04-02',NULL,'2024-12-13'),
(20010,'Benjamin Johansson',false,'Inaktiv',1490,1350,'Thales/bSpoke','DIR','2024-08-19','2025-08-31','2025-08-31'),
(20014,'Edvard Narum',false,'Inaktiv',1150,1075,'Voca','DIR','2024-10-14','2025-10-31','2025-10-31'),
(20015,'Kacper Wysocki',true,'Inaktiv',1500,1050,'PONE Biometrics AS','DIR','2024-10-15','2025-12-31','2025-11-16'),
(20021,'Karl Eirik Bang Fossberg',true,'Inaktiv',1380,886,'Tomra ASA','DIR','2025-08-04','2026-02-27','2026-02-27'),
(20019,'Thomas Ax Gulbransrød',false,'Inaktiv',1100,1050,'Six Robotics','DIR','2025-03-13','2026-03-13','2025-12-31'),
(20020,'Filip Dovland',true,'Inaktiv',1580,1106,'Tomra ASA','DIR','2025-08-04','2025-11-30','2025-11-30');
