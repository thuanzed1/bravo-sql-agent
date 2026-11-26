# Huong dan khoi phuc co so du lieu Quan_Ly_Kho_Hang

Thu muc nay chua tep script khoi tao va du lieu mau cho co so du lieu SQL Server `Quan_Ly_Kho_Hang`.

## Cac tep trong thu muc
- `Quan_Ly_Kho_Hang.sql`: Script DDL tao bang va DML nap hon 49.000 ban ghi thuc te gom cac bang `Ton_Dau`, `CTCT`, `CT`, `DMVT`, `DMDoiTuong`, `DMKho`.

## Cach thuc thi tren SQL Server
1. Mo SQL Server Management Studio (SSMS).
2. Ket noi den SQL Server Instance cua ban.
3. Tao co so du lieu moi ten la `Quan_Ly_Kho_Hang`:
   ```sql
   CREATE DATABASE Quan_Ly_Kho_Hang;
   GO
   USE Quan_Ly_Kho_Hang;
   GO
   ```
4. Mo tep `database/Quan_Ly_Kho_Hang.sql` trong SSMS va an **Execute** (hoac F5).
5. Kiem tra cac bang du lieu:
   ```sql
   SELECT COUNT(*) FROM dbo.Ton_Dau;
   SELECT COUNT(*) FROM dbo.CTCT;
   SELECT COUNT(*) FROM dbo.CT;
   SELECT COUNT(*) FROM dbo.DMVT;
   ```
